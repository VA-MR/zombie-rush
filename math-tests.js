/**
 * ZOMBIE RUSH - Mathematical Verification Tests
 * Run this file in browser console or Node.js to verify game math
 */

// ============================================
// GAME CONFIG (Mirror of main game)
// ============================================
const TestConfig = {
    targetDuration: 10,  // All lanes reach max in 10 seconds
    lanes: {
        // Natural jackpot rate = (1-houseEdge)/maxMultiplier
        safe: {
            maxMultiplier: 4.0,
            houseEdge: 0.05,          // 5% house edge
            speedConstant: 0.1386,    // ln(4)/10 - reaches 4x in 10s
            // Natural jackpot rate = 0.95/4 = 23.75%
        },
        medium: {
            maxMultiplier: 10.0,
            houseEdge: 0.05,          // 5% house edge
            speedConstant: 0.2303,    // ln(10)/10 - reaches 10x in 10s
            // Natural jackpot rate = 0.95/10 = 9.5%
        },
        wild: {
            maxMultiplier: 50.0,
            houseEdge: 0.05,          // 5% house edge
            speedConstant: 0.3912,    // ln(50)/10 - reaches 50x in 10s
            // Natural jackpot rate = 0.95/50 = 1.9%
        }
    }
};

// ============================================
// CORE MATH FUNCTIONS (Mirror of game)
// ============================================

/**
 * Provably-fair crash point calculation
 * Formula: crashPoint = (1 - houseEdge) / random
 * 
 * This guarantees:
 * - P(crash > X) = (1-h)/X for any multiplier X
 * - House edge = h at ALL cashout points
 * - Natural jackpot rate = (1-h)/maxMultiplier
 */
function calculateCrashPoint_ORIGINAL(laneName) {
    const config = TestConfig.lanes[laneName];
    
    // Single random for provably fair result
    const random = Math.random();
    const safeRandom = Math.max(random, 0.0001);
    
    // Standard crash formula
    const crashPoint = (1 - config.houseEdge) / safeRandom;
    
    // Cap at max multiplier
    return Math.min(crashPoint, config.maxMultiplier);
}

/**
 * Multiplier calculation
 */
function calculateMultiplier(elapsedMs, speedConstant) {
    return Math.pow(Math.E, speedConstant * elapsedMs / 1000);
}

/**
 * Inverse: Time to reach a multiplier
 */
function timeToReachMultiplier(targetMultiplier, speedConstant) {
    return (Math.log(targetMultiplier) / speedConstant) * 1000;
}

// ============================================
// STATISTICAL TESTS
// ============================================

/**
 * Test 1: Crash Point Distribution Analysis
 */
function testCrashPointDistribution(laneName, iterations = 100000) {
    const config = TestConfig.lanes[laneName];
    let jackpots = 0;
    let instantCrashes = 0;
    let normalCrashes = 0;
    let crashPoints = [];
    
    for (let i = 0; i < iterations; i++) {
        const crash = calculateCrashPoint_ORIGINAL(laneName);
        crashPoints.push(crash);
        
        if (crash >= config.maxMultiplier) {
            jackpots++;
        } else if (crash <= 1.01) {
            instantCrashes++;
        } else {
            normalCrashes++;
        }
    }
    
    const avgCrashPoint = crashPoints.reduce((a, b) => a + b, 0) / iterations;
    const medianCrashPoint = crashPoints.sort((a, b) => a - b)[Math.floor(iterations / 2)];
    
    // Natural jackpot rate = (1-houseEdge)/maxMultiplier
    const naturalJackpotRate = (1 - config.houseEdge) / config.maxMultiplier;
    
    return {
        lane: laneName,
        iterations,
        jackpots: {
            count: jackpots,
            actual: (jackpots / iterations * 100).toFixed(2) + '%',
            expected: (naturalJackpotRate * 100).toFixed(2) + '%'
        },
        instantCrashes: {
            count: instantCrashes,
            actual: (instantCrashes / iterations * 100).toFixed(2) + '%',
            note: 'No separate instant crash - part of distribution'
        },
        normalCrashes: {
            count: normalCrashes,
            percentage: (normalCrashes / iterations * 100).toFixed(2) + '%'
        },
        averageCrashPoint: avgCrashPoint.toFixed(4),
        medianCrashPoint: medianCrashPoint.toFixed(4)
    };
}

/**
 * Test 2: Expected Value (EV) Calculation
 * Simulates many rounds to calculate actual house edge
 */
function testExpectedValue(laneName, betAmount = 100, iterations = 100000) {
    const config = TestConfig.lanes[laneName];
    let totalWagered = 0;
    let totalReturned = 0;
    let wins = 0;
    let losses = 0;
    
    for (let i = 0; i < iterations; i++) {
        const crashPoint = calculateCrashPoint_ORIGINAL(laneName);
        totalWagered += betAmount;
        
        // Simulate "optimal" cash out at 2x if possible
        const targetCashout = 2.0;
        
        if (crashPoint >= targetCashout) {
            totalReturned += betAmount * targetCashout;
            wins++;
        } else {
            losses++;
        }
    }
    
    const ev = (totalReturned - totalWagered) / totalWagered * 100;
    
    return {
        lane: laneName,
        strategy: 'Cash out at 2x',
        iterations,
        totalWagered: totalWagered.toFixed(2),
        totalReturned: totalReturned.toFixed(2),
        netResult: (totalReturned - totalWagered).toFixed(2),
        expectedValue: ev.toFixed(4) + '%',
        winRate: (wins / iterations * 100).toFixed(2) + '%',
        wins,
        losses
    };
}

/**
 * Test 3: Probability of reaching multiplier X
 */
function testProbabilityOfReachingMultiplier(laneName, targetMultiplier, iterations = 100000) {
    let successes = 0;
    
    for (let i = 0; i < iterations; i++) {
        const crashPoint = calculateCrashPoint_ORIGINAL(laneName);
        if (crashPoint >= targetMultiplier) {
            successes++;
        }
    }
    
    const actualProb = successes / iterations;
    
    // Theoretical probability (without jackpot/instant crash adjustments)
    const config = TestConfig.lanes[laneName];
    const theoreticalProb = (1 - config.houseEdge) / targetMultiplier;
    
    return {
        lane: laneName,
        targetMultiplier: targetMultiplier + 'x',
        iterations,
        successes,
        actualProbability: (actualProb * 100).toFixed(4) + '%',
        theoreticalProbability: (theoreticalProb * 100).toFixed(4) + '%',
        fairOdds: (1 / actualProb).toFixed(2) + 'x'
    };
}

/**
 * Test 4: Multiplier Growth Over Time
 */
function testMultiplierGrowth() {
    const testPoints = [0, 1000, 2000, 4000, 6000, 8000, 10000, 12000];
    
    return testPoints.map(ms => ({
        timeMs: ms,
        timeSeconds: (ms / 1000).toFixed(1),
        safeMultiplier: calculateMultiplier(ms, TestConfig.lanes.safe.speedConstant).toFixed(2) + 'x',
        mediumMultiplier: calculateMultiplier(ms, TestConfig.lanes.medium.speedConstant).toFixed(2) + 'x',
        wildMultiplier: calculateMultiplier(ms, TestConfig.lanes.wild.speedConstant).toFixed(2) + 'x',
        // When would safe/medium/wild max out?
        safeMaxReached: calculateMultiplier(ms, TestConfig.lanes.safe.speedConstant) >= 4.0,
        mediumMaxReached: calculateMultiplier(ms, TestConfig.lanes.medium.speedConstant) >= 10.0,
        wildMaxReached: calculateMultiplier(ms, TestConfig.lanes.wild.speedConstant) >= 50.0
    }));
}

/**
 * Test 5: Time to Max Multiplier
 */
function testTimeToMaxMultiplier() {
    return {
        safe: {
            maxMultiplier: '4.0x',
            speedConstant: TestConfig.lanes.safe.speedConstant,
            timeToReach: (timeToReachMultiplier(4.0, TestConfig.lanes.safe.speedConstant) / 1000).toFixed(2) + ' seconds'
        },
        medium: {
            maxMultiplier: '10.0x',
            speedConstant: TestConfig.lanes.medium.speedConstant,
            timeToReach: (timeToReachMultiplier(10.0, TestConfig.lanes.medium.speedConstant) / 1000).toFixed(2) + ' seconds'
        },
        wild: {
            maxMultiplier: '50.0x',
            speedConstant: TestConfig.lanes.wild.speedConstant,
            timeToReach: (timeToReachMultiplier(50.0, TestConfig.lanes.wild.speedConstant) / 1000).toFixed(2) + ' seconds'
        }
    };
}

/**
 * Test 6: House Edge Verification
 * True house edge = 1 - EV per unit wagered
 */
function testTrueHouseEdge(laneName, iterations = 100000) {
    const results = [];
    const cashoutPoints = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 10.0];
    
    cashoutPoints.forEach(target => {
        let totalWagered = 0;
        let totalReturned = 0;
        
        for (let i = 0; i < iterations; i++) {
            const crashPoint = calculateCrashPoint_ORIGINAL(laneName);
            totalWagered += 1;
            
            if (crashPoint >= target) {
                totalReturned += target;
            }
        }
        
        const ev = totalReturned / totalWagered;
        const houseEdge = (1 - ev) * 100;
        
        results.push({
            cashoutTarget: target + 'x',
            expectedReturn: ev.toFixed(4),
            houseEdge: houseEdge.toFixed(2) + '%'
        });
    });
    
    return {
        lane: laneName,
        iterations,
        results
    };
}

/**
 * Test 7: Verify Probability Distribution
 * The crash point formula should follow: P(crash > x) = (1-h)/x
 */
function testDistributionFormula(laneName, iterations = 100000) {
    const testMultipliers = [1.5, 2.0, 3.0, 4.0, 5.0, 7.0, 10.0, 20.0, 50.0];
    const config = TestConfig.lanes[laneName];
    const results = [];
    
    // Collect all crash points
    const crashPoints = [];
    for (let i = 0; i < iterations; i++) {
        crashPoints.push(calculateCrashPoint_ORIGINAL(laneName));
    }
    
    testMultipliers.forEach(mult => {
        if (mult > config.maxMultiplier) return;
        
        const countAbove = crashPoints.filter(cp => cp >= mult).length;
        const actualProb = countAbove / iterations;
        
        // With formula crashPoint = (1-h)/r:
        // P(crash > X) = P((1-h)/r > X) = P(r < (1-h)/X) = (1-h)/X
        // This is the theoretical probability (capped at maxMultiplier)
        const theoreticalProb = Math.min((1 - config.houseEdge) / mult, 1);
        
        results.push({
            multiplier: mult + 'x',
            actualProbability: (actualProb * 100).toFixed(3) + '%',
            theoreticalProbability: (theoreticalProb * 100).toFixed(3) + '%',
            difference: Math.abs(actualProb - theoreticalProb).toFixed(5)
        });
    });
    
    return {
        lane: laneName,
        iterations,
        results
    };
}

// ============================================
// RUN ALL TESTS
// ============================================

function runAllTests() {
    console.log('='.repeat(60));
    console.log('🧟 ZOMBIE RUSH - MATHEMATICAL VERIFICATION TESTS');
    console.log('='.repeat(60));
    
    const iterations = 100000;
    
    console.log('\n📊 TEST 1: Crash Point Distribution');
    console.log('-'.repeat(40));
    ['safe', 'medium', 'wild'].forEach(lane => {
        console.log('\n' + lane.toUpperCase() + ' Lane:');
        console.table(testCrashPointDistribution(lane, iterations));
    });
    
    console.log('\n📊 TEST 2: Expected Value (Cash out at 2x)');
    console.log('-'.repeat(40));
    ['safe', 'medium', 'wild'].forEach(lane => {
        console.log('\n' + lane.toUpperCase() + ' Lane:');
        console.table(testExpectedValue(lane, 100, iterations));
    });
    
    console.log('\n📊 TEST 3: Probability of Reaching Multipliers');
    console.log('-'.repeat(40));
    const testMultipliers = [1.5, 2.0, 3.0, 5.0, 10.0];
    testMultipliers.forEach(mult => {
        console.log(`\nTarget: ${mult}x`);
        ['safe', 'medium', 'wild'].forEach(lane => {
            const config = TestConfig.lanes[lane];
            if (mult <= config.maxMultiplier) {
                const result = testProbabilityOfReachingMultiplier(lane, mult, iterations);
                console.log(`  ${lane}: ${result.actualProbability} (fair odds: ${result.fairOdds})`);
            }
        });
    });
    
    console.log('\n📊 TEST 4: Multiplier Growth Over Time');
    console.log('-'.repeat(40));
    console.table(testMultiplierGrowth());
    
    console.log('\n📊 TEST 5: Time to Max Multiplier');
    console.log('-'.repeat(40));
    console.table(testTimeToMaxMultiplier());
    
    console.log('\n📊 TEST 6: True House Edge at Various Cashout Points');
    console.log('-'.repeat(40));
    ['safe', 'medium', 'wild'].forEach(lane => {
        console.log('\n' + lane.toUpperCase() + ' Lane:');
        const result = testTrueHouseEdge(lane, iterations);
        console.table(result.results);
    });
    
    console.log('\n📊 TEST 7: Distribution Formula Verification');
    console.log('-'.repeat(40));
    ['safe', 'medium', 'wild'].forEach(lane => {
        console.log('\n' + lane.toUpperCase() + ' Lane:');
        const result = testDistributionFormula(lane, iterations);
        console.table(result.results);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests complete!');
    console.log('='.repeat(60));
}

// ============================================
// INDIVIDUAL TEST RUNNERS
// ============================================

function quickTest() {
    console.log('🧟 Quick Verification (10k iterations)');
    console.log('Safe Lane:', testCrashPointDistribution('safe', 10000));
    console.log('Medium Lane:', testCrashPointDistribution('medium', 10000));
    console.log('Wild Lane:', testCrashPointDistribution('wild', 10000));
}

// ============================================
// MATHEMATICAL ISSUE DETECTION
// ============================================

function detectMathIssues() {
    console.log('🔍 MATHEMATICAL ISSUE DETECTION');
    console.log('='.repeat(50));
    
    const issues = [];
    
    // Issue 1: Check if house edge matches expected
    console.log('\n1. Checking House Edge Consistency...');
    ['safe', 'medium', 'wild'].forEach(lane => {
        const result = testTrueHouseEdge(lane, 50000);
        const at2x = result.results.find(r => r.cashoutTarget === '2.0x');
        const actualEdge = parseFloat(at2x.houseEdge);
        const configEdge = TestConfig.lanes[lane].houseEdge * 100;
        
        if (Math.abs(actualEdge - configEdge) > 2) {
            issues.push({
                severity: 'HIGH',
                lane,
                issue: `House edge mismatch at 2x: configured ${configEdge}%, actual ${actualEdge.toFixed(2)}%`
            });
        }
    });
    
    // Issue 2: Check jackpot probability
    console.log('\n2. Checking Jackpot Probabilities...');
    ['safe', 'medium', 'wild'].forEach(lane => {
        const result = testCrashPointDistribution(lane, 50000);
        const actualJackpot = parseFloat(result.jackpots.actual);
        const expectedJackpot = parseFloat(result.jackpots.expected);
        
        if (Math.abs(actualJackpot - expectedJackpot) > 1) {
            issues.push({
                severity: 'MEDIUM',
                lane,
                issue: `Jackpot probability off: expected ${expectedJackpot}%, got ${actualJackpot}%`
            });
        }
    });
    
    // Issue 3: Check instant crash rate
    console.log('\n3. Checking Instant Crash Rates...');
    ['safe', 'medium', 'wild'].forEach(lane => {
        const result = testCrashPointDistribution(lane, 50000);
        const actualInstant = parseFloat(result.instantCrashes.actual);
        const expectedInstant = parseFloat(result.instantCrashes.expected);
        
        if (Math.abs(actualInstant - expectedInstant) > 1) {
            issues.push({
                severity: 'MEDIUM',
                lane,
                issue: `Instant crash rate off: expected ${expectedInstant}%, got ${actualInstant}%`
            });
        }
    });
    
    console.log('\n📋 ISSUES FOUND:');
    if (issues.length === 0) {
        console.log('✅ No significant issues detected!');
    } else {
        console.table(issues);
    }
    
    return issues;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        quickTest,
        detectMathIssues,
        testCrashPointDistribution,
        testExpectedValue,
        testProbabilityOfReachingMultiplier,
        testMultiplierGrowth,
        testTimeToMaxMultiplier,
        testTrueHouseEdge,
        testDistributionFormula
    };
}

// Auto-run instructions
console.log('='.repeat(60));
console.log('🧟 ZOMBIE RUSH - Math Test Suite Loaded');
console.log('='.repeat(60));
console.log('');
console.log('Available commands:');
console.log('  runAllTests()       - Run complete test suite');
console.log('  quickTest()         - Quick 10k iteration test');
console.log('  detectMathIssues()  - Scan for mathematical problems');
console.log('');
console.log('Individual tests:');
console.log('  testCrashPointDistribution("safe", 100000)');
console.log('  testExpectedValue("medium", 100, 100000)');
console.log('  testTrueHouseEdge("wild", 100000)');
console.log('');

