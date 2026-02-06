/**
 * Logic to restructure large text into concise, exam-ready notes.
 * Rules: Preserve accuracy, remove filler, prioritize formulas/steps.
 */
export const restructureContent = (text) => {
    if (!text) return null;

    const lines = text.split('\n');

    const result = {
        topic: "Core Concept",
        concepts: [],
        definitions: {},
        formulas: [],
        tips: [],
        // Phase 2 Data
        mcqs: [],
        condensedNotes: [],
        memoryAids: [],
        examFocus: [],
        lastMinuteNotes: []
    };

    let topicFound = false;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Detect Filler/Intro (Meta-talk/Conversational)
        const isIntroPhrase = /^(alright|if you want|here is|welcome|this is|structured|comprehensive|no filler)/i.test(trimmed);
        if (index < 5 && isIntroPhrase) {
            return;
        }

        // Topic detection (Search for the first meaningful subject)
        if (!topicFound) {
            // Priority 1: Markdown Headers
            if (trimmed.startsWith('#')) {
                result.topic = trimmed.replace(/[#*]/g, '').trim();
                topicFound = true;
            }
            // Priority 2: Bolded Subject appearing early
            else if (trimmed.includes('**') && trimmed.length < 100) {
                result.topic = trimmed.split('**')[1].trim();
                topicFound = true;
            }
            // Priority 3: First substantial non-filler line
            else if (trimmed.length > 5 && trimmed.length < 80 && !isIntroPhrase) {
                result.topic = trimmed.split(':')[0].trim();
                topicFound = true;
            }
        }

        // Detect definitions
        if (trimmed.includes(':') || trimmed.includes(' - ')) {
            const parts = trimmed.split(/[:\-]/);
            if (parts.length >= 2) {
                const term = parts[0];
                const def = parts.slice(1).join(':').trim();
                result.definitions[term] = def;
                result.condensedNotes.push({ title: term, content: def, type: 'definition' });
                return;
            }
        }

        // Detect formulas
        if (trimmed.includes('=') && /[\+\-\*\/]/.test(trimmed)) {
            result.formulas.push(trimmed);
            result.condensedNotes.push({ title: "Formulas", content: trimmed, type: 'formula' });
            return;
        }

        // KEY CONCEPTS EXTRACTION (concise subjects only)
        // 1. Markdown Headers
        if (trimmed.startsWith('#')) {
            result.concepts.push(trimmed);
        }
        // 2. Bolded Subjects (Extract just the bolded part or the line if short)
        else if (trimmed.includes('**')) {
            result.concepts.push(trimmed);
        }
        // 3. Short lines (bullet points, subjects)
        else if (trimmed.length < 60 && (trimmed.startsWith('*') || trimmed.startsWith('-') || /^[0-9]\./.test(trimmed))) {
            result.concepts.push(trimmed);
        }
    });

    // Generate MCQs based on definitions/concepts (Clean up for questions)
    Object.entries(result.definitions).slice(0, 3).forEach(([term, def]) => {
        const cleanTerm = term.replace(/[#*]/g, '').trim();
        result.mcqs.push({
            question: `Which of the following describes the term "${cleanTerm}"?`,
            options: [
                def,
                "A process that occurs in isolation without any external factors.",
                "The mathematical inverse of the primary relationship.",
                "NONE of the above."
            ],
            correct: 0
        });
    });

    // Generate Memory Aids
    if (Object.keys(result.definitions).length > 0) {
        const firstTerm = Object.keys(result.definitions)[0];
        result.memoryAids.push({
            type: "Mnemonic",
            title: firstTerm,
            content: `Think of "${firstTerm}" as a "Master Key" - it opens up the primary function of the system.`
        });
    }
    result.memoryAids.push({
        type: "Analogy",
        title: "System Flow",
        content: "The flow of data is like water in a pipe; any blockage (error) stops the secondary output."
    });

    // Generate Exam Focus
    result.examFocus = [
        { topic: result.topic, weight: "High", priority: "Critical", tip: "Ensure you understand the cause-effect relationship here." },
        { topic: "Variable Relations", weight: "Medium", priority: "Important", tip: "Watch out for unit conversions in formulas." }
    ];

    // Generate Last-Minute / Rapid Revision Data
    result.lastMinuteNotes = result.concepts.slice(0, 5).map(c => ({
        text: c,
        mustRevise: c.length < 50 || /!|important|key|primary/i.test(c)
    }));

    if (result.formulas.length > 0) {
        result.lastMinuteNotes.push({
            text: `CRITICAL FORMULA: ${result.formulas[0]}`,
            mustRevise: true
        });
    }

    result.tips.push("Practice drawing the relationship diagrams to reinforce memory.");
    result.tips.push("High priority: Review the edge cases where this theory might fail.");

    // Generate Active Learning Questions (Legacy support)
    result.questions = result.mcqs.map(m => m.question);

    return result;
};
