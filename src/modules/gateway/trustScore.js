/**
 * Gateway Trust Score Calculation
 * 
 * Evaluates member trustworthiness based on account age, verification attempts,
 * and verification speed. Returns a score (0-100) and risk level for future
 * modules (anti-raid, moderation, spam control).
 */

export function calculateGatewayTrustScore(member, verificationMeta = {}) {
    let score = 0;

    // Account age scoring
    // >= 365 days → +30
    // >= 30 days → +15
    // else → +5
    const accountAgeDays = Math.floor((Date.now() - new Date(member.user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (accountAgeDays >= 365) {
        score += 30;
    } else if (accountAgeDays >= 30) {
        score += 15;
    } else {
        score += 5;
    }

    // Verification attempts scoring
    // 1 attempt → +20
    // 2-3 attempts → +10
    // more → +0
    const attempts = verificationMeta.attempts || 1;
    if (attempts === 1) {
        score += 20;
    } else if (attempts >= 2 && attempts <= 3) {
        score += 10;
    }

    // Verification speed scoring (in minutes)
    // fast (<5 minutes) → +10
    // else → +5
    const verificationTimeMs = verificationMeta.verificationTimeMs || Infinity;
    const verificationTimeMinutes = verificationTimeMs / (1000 * 60);
    if (verificationTimeMinutes < 5) {
        score += 10;
    } else {
        score += 5;
    }

    // Clamp between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    // >= 70 → low
    // 40-69 → medium
    // < 40 → high
    let risk;
    if (score >= 70) {
        risk = 'low';
    } else if (score >= 40) {
        risk = 'medium';
    } else {
        risk = 'high';
    }

    return {
        score,
        risk,
    };
}
