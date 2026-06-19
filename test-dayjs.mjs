import dayjs from 'dayjs';
console.log('Test 1: default dayjs import OK');

try {
  import('dayjs/plugin/customParseFormat').then(mod => {
    console.log('Test 2: dynamic import with .js OK');
    dayjs.extend(mod.default);
    const result = dayjs('2000-01-01 08:00', 'YYYY-MM-DD HH:mm');
    console.log('Test 3: parse with customParseFormat:', result.isValid(), result.format('YYYY-MM-DD HH:mm'));
  }).catch(e => {
    console.log('Test 2 failed:', e.message);
  });
} catch(e) {
  console.log('Test 2 try-catch failed:', e.message);
}

try {
  const refDate = '2000-01-01';
  const start = dayjs(`${refDate} 08:00`, 'YYYY-MM-DD HH:mm');
  console.log('Test 4: default parse (no plugin):', start.isValid(), start.format('YYYY-MM-DD HH:mm'));
} catch(e) {
  console.log('Test 4 failed:', e.message);
}
