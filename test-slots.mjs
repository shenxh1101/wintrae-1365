import { splitTimeSlots } from './src/utils/dateUtils.js';

console.log('=== 测试 splitTimeSlots ===\n');

const testCases = [
  { start: '08:00', end: '10:00', duration: 30, expectedCount: 4, desc: '08:00-10:00 间隔30分钟' },
  { start: '09:00', end: '12:00', duration: 15, expectedCount: 12, desc: '09:00-12:00 间隔15分钟' },
  { start: '14:00', end: '17:00', duration: 20, expectedCount: 9, desc: '14:00-17:00 间隔20分钟' },
];

let allPassed = true;

for (const tc of testCases) {
  const result = splitTimeSlots(tc.start, tc.end, tc.duration);
  const passed = result.length === tc.expectedCount;
  allPassed = allPassed && passed;
  console.log(`${passed ? '✅' : '❌'} ${tc.desc}`);
  console.log(`   期望: ${tc.expectedCount} 个, 实际: ${result.length} 个`);
  if (result.length > 0) {
    console.log(`   第一个: ${result[0].startTime}-${result[0].endTime}`);
    console.log(`   最后一个: ${result[result.length-1].startTime}-${result[result.length-1].endTime}`);
  }
  console.log();
}

console.log(allPassed ? '✅ 所有测试通过！' : '❌ 有测试失败！');
process.exit(allPassed ? 0 : 1);
