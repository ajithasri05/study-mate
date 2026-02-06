import pandas as pd
from server.utils.database import SessionLocal, QuizResult, StudySession

def get_performance_analytics():
    """
    Uses pandas to analyze quiz results and identify weak topics.
    """
    db = SessionLocal()
    # Join QuizResult with StudySession to get topic names
    results = db.query(QuizResult, StudySession.topic)\
        .join(StudySession, QuizResult.session_id == StudySession.id)\
        .all()
    
    if not results:
        db.close()
        return {"mastery": 0, "weak_topics": [], "total_sessions": 0, "topic_breakdown": []}

    # Load results into a pandas DataFrame
    df = pd.DataFrame([
        {
            "id": r[0].id,
            "session_id": r[0].session_id,
            "topic": r[1] or "Unknown Topic",
            "score": r[0].score,
            "total": r[0].total,
            "weak_topics": r[0].weak_topics.split(",") if r[0].weak_topics else []
        } for r in results
    ])

    # Calculate overall mastery percentage
    df['percentage'] = (df['score'] / df['total']) * 100
    avg_mastery = df['percentage'].mean()

    # Identify weak topics (flatten list and count frequencies)
    all_weak_topics = [topic for sublist in df['weak_topics'] for topic in sublist if topic]
    weak_topic_counts = pd.Series(all_weak_topics).value_counts().to_dict() if all_weak_topics else {}
    
    # Sort weak topics by frequency
    sorted_weak_topics = sorted(weak_topic_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Calculate Per-Topic Mastery
    topic_stats = df.groupby('topic')['percentage'].mean().reset_index()
    topic_breakdown = [
        {"topic": row['topic'], "mastery": round(row['percentage'], 1)}
        for _, row in topic_stats.iterrows()
    ]

    db.close()
    return {
        "mastery": round(avg_mastery, 2),
        "weak_topics": [topic for topic, count in sorted_weak_topics[:5]],
        "total_sessions": len(df['session_id'].unique()),
        "topic_breakdown": topic_breakdown
    }
