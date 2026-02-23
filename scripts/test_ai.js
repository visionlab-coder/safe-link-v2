import { analyzeMessageWithAI } from './src/utils/ai/watchdog.js';

async function testWatchdog() {
    console.log("--- AI Watchdog Simulation Test ---");

    const safeMessage = "오늘 작업 시작합니다. 다들 화이팅!";
    console.log(`\n[Input]: "${safeMessage}"`);
    const result1 = await analyzeMessageWithAI(safeMessage);
    console.log("[Result]:", JSON.stringify(result1, null, 2));

    const dangerMessage = "현장에서 누군가 미끄러졌어요! 발이 다쳤습니다.";
    console.log(`\n[Input]: "${dangerMessage}"`);
    const result2 = await analyzeMessageWithAI(dangerMessage);
    console.log("[Result]:", JSON.stringify(result2, null, 2));

    console.log("\n--- Test Completed ---");
}

testWatchdog();
