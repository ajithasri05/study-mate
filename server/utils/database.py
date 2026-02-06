from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import json

DATABASE_URL = "sqlite:///./study_mate.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class StudySession(Base):
    __tablename__ = "study_sessions"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String)
    raw_content = Column(Text)
    summary_json = Column(Text)  # Store as JSON string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id"))
    score = Column(Integer)
    total = Column(Integer)
    weak_topics = Column(String)  # Comma separated
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def save_study_session(topic, raw_content, summary_json):
    db = SessionLocal()
    session = StudySession(
        topic=topic,
        raw_content=raw_content,
        summary_json=json.dumps(summary_json)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    db.close()
    return session.id

def save_quiz_result(session_id, score, total, weak_topics):
    db = SessionLocal()
    result = QuizResult(
        session_id=session_id,
        score=score,
        total=total,
        weak_topics=",".join(weak_topics) if weak_topics else ""
    )
    db.add(result)
    db.commit()
    db.close()

def get_study_history():
    db = SessionLocal()
    sessions = db.query(StudySession).order_by(StudySession.created_at.desc()).all()
    history = []
    for s in sessions:
        history.append({
            "id": s.id,
            "topic": s.topic,
            "date": s.created_at.isoformat(),
            "summary": json.loads(s.summary_json)
        })
    db.close()
    db.close()
    return history

def clear_study_history():
    db = SessionLocal()
    db.query(QuizResult).delete()
    db.query(StudySession).delete()
    db.commit()
    db.close()
