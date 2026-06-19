const baseUrl = 'http://localhost:3000';
const today = new Date().toISOString().split('T')[0];

async function api(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, options);
  return await res.json();
}

async function runTests() {
  const results = [];
  const log = (step, status, data = null) => {
    console.log(`\n${status === '✅' ? '✅' : '❌'} ${step}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    results.push({ step, status, data });
  };

  try {
    // 1. 健康检查
    const health = await api('GET', '/health');
    log('1. 健康检查', health.status === 'ok' ? '✅' : '❌', health);

    // 2. 新增医生
    const doctor = await api('POST', '/api/doctors', {
      name: '张医生',
      department: '内科',
      title: '主任医师',
      phone: '13800000001'
    });
    const doctorId = doctor.data?._id;
    log('2. 新增医生', doctor.success ? '✅' : '❌', { doctorId, name: doctor.data?.name });

    // 3. 创建排班
    const schedule = await api('POST', '/api/schedules/temporary', {
      doctorId,
      date: today,
      startTime: '08:00',
      endTime: '10:00',
      totalSlots: 4
    });
    const scheduleId = schedule.data?._id;
    log('3. 创建排班', schedule.success ? '✅' : '❌', { scheduleId });

    // 4. 生成号源
    const slots = await api('POST', '/api/slots/generate', {
      scheduleId,
      durationMinutes: 30
    });
    const slot0Id = slots.data?.slots?.[0]?._id;
    const slot1Id = slots.data?.slots?.[1]?._id;
    log('4. 生成号源', slots.success && slots.data?.count === 4 ? '✅' : '❌', { count: slots.data?.count, slot0Id, slot1Id });

    // 5. 患者A预约第一个号源
    await api('POST', '/api/appointments/lock', {
      slotId: slot0Id,
      patientName: '患者A',
      patientPhone: '13900000001'
    });
    const confirmA = await api('POST', '/api/appointments/confirm', {
      slotId: slot0Id,
      patientName: '患者A',
      patientPhone: '13900000001'
    });
    const appointmentAId = confirmA.data?.appointment?._id;
    log('5. 患者A预约号源0', confirmA.success ? '✅' : '❌', { appointmentAId, slotStatus: confirmA.data?.slot?.status });

    // 6. 患者B尝试预约已满的号源0，应该被拒
    const tryLockB = await api('POST', '/api/appointments/lock', {
      slotId: slot0Id,
      patientName: '患者B',
      patientPhone: '13900000002'
    });
    log('6. 患者B尝试预约已满号源(被拒)', !tryLockB.success ? '✅' : '❌', { message: tryLockB.message });

    // 7. 患者B加入候补队列
    const waitlistB = await api('POST', '/api/waitlist', {
      slotId: slot0Id,
      patientName: '患者B',
      patientPhone: '13900000002'
    });
    const waitlistBId = waitlistB.data?._id;
    log('7. 患者B加入候补', waitlistB.success ? '✅' : '❌', { waitlistBId, position: waitlistB.data?.position });

    // 8. 患者C也加入候补
    const waitlistC = await api('POST', '/api/waitlist', {
      slotId: slot0Id,
      patientName: '患者C',
      patientPhone: '13900000003'
    });
    const waitlistCId = waitlistC.data?._id;
    log('8. 患者C加入候补', waitlistC.success ? '✅' : '❌', { waitlistCId, position: waitlistC.data?.position });

    // 9. 查看号源0的候补队列
    const waitlistList = await api('GET', `/api/waitlist/slot/${slot0Id}`);
    log('9. 查看候补队列', waitlistList.success && waitlistList.data?.length === 2 ? '✅' : '❌', {
      count: waitlistList.data?.length,
      list: waitlistList.data?.map(w => ({ name: w.patientName, pos: w.position, status: w.status }))
    });

    // 10. 患者A取消预约，触发候补通知
    const cancelA = await api('POST', `/api/appointments/${appointmentAId}/cancel`, {
      reason: '个人原因取消'
    });
    log('10. 患者A取消预约(触发候补通知)', cancelA.success ? '✅' : '❌', {
      slotStatus: cancelA.data?.slot?.status,
      notifiedWaitlist: cancelA.data?.notifiedWaitlist ? {
        name: cancelA.data.notifiedWaitlist.patientName,
        status: cancelA.data.notifiedWaitlist.status
      } : null
    });

    // 11. 查看候补队列状态变化
    const waitlistAfter = await api('GET', `/api/waitlist/slot/${slot0Id}`);
    log('11. 候补队列状态变化', waitlistAfter.success ? '✅' : '❌', waitlistAfter.data?.map(w => ({
      name: w.patientName,
      pos: w.position,
      status: w.status,
      notified: !!w.notifiedAt,
      hasExpireAt: !!w.expiredAt
    })));

    // 12. 查看通知记录
    const notifications = await api('GET', '/api/notifications');
    log('12. 查看通知记录', notifications.success ? '✅' : '❌', {
      total: notifications.data?.total,
      types: notifications.data?.list?.map(n => ({ type: n.type, patient: n.patientPhone }))
    });

    // 13. 患者B(候补第一位)确认预约
    const confirmB = await api('POST', `/api/waitlist/${waitlistBId}/confirm`);
    log('13. 候补患者B确认预约', confirmB.success ? '✅' : '❌', confirmB.data ? {
      appointmentId: confirmB.data.appointment?._id,
      slotStatus: confirmB.data.slot?.status,
      waitlistStatus: confirmB.data.waitlist?.status
    } : confirmB);

    // 14. 查看候补队列，患者C位置前移
    const waitlistFinal = await api('GET', `/api/waitlist/slot/${slot0Id}`);
    log('14. 患者C位置前移', waitlistFinal.success ? '✅' : '❌', waitlistFinal.data?.map(w => ({
      name: w.patientName,
      pos: w.position,
      status: w.status
    })));

    // 15. 管理员汇总查询
    const adminSummary = await api('GET', `/api/statistics/admin/summary?date=${today}`);
    log('15. 管理员汇总查询', adminSummary.success ? '✅' : '❌', adminSummary.data?.map(s => ({
      doctor: s.doctorName,
      slots: s.slots,
      appointments: s.appointments,
      waitlist: s.waitlist,
      rates: s.rates
    })));

    // 16. 排班详情查询
    const scheduleDetail = await api('GET', `/api/statistics/schedule/${scheduleId}/detail`);
    log('16. 排班详情查询', scheduleDetail.success ? '✅' : '❌', {
      schedule: scheduleDetail.data?.schedule,
      summary: scheduleDetail.data?.summary,
      abnormalAnalysis: scheduleDetail.data?.abnormalAnalysis
    });

    // 17. 临时停诊测试
    const suspension = await api('POST', '/api/schedules/suspension', {
      doctorId,
      date: today,
      startTime: '09:00',
      endTime: '10:00',
      reason: '医生临时有事'
    });
    log('17. 临时停诊', suspension.success ? '✅' : '❌', { suspendedCount: suspension.data?.suspendedSlotCount });

    // 18. 查看停诊通知
    const notifications2 = await api('GET', '/api/notifications?type=suspension');
    log('18. 停诊通知', notifications2.success ? '✅' : '❌', {
      count: notifications2.data?.total,
      list: notifications2.data?.list?.map(n => ({
        type: n.type,
        content: n.content?.substring(0, 60)
      }))
    });

    // 19. 患者查询候补状态
    const waitlistStatus = await api('GET', `/api/waitlist/status?patientPhone=13900000003&doctorId=${doctorId}&date=${today}`);
    log('19. 患者C查询候补状态', waitlistStatus.success ? '✅' : '❌', waitlistStatus.data);

    // 20. 按类型查询通知
    const confirmedNotifs = await api('GET', '/api/notifications?type=confirmed');
    const cancelledNotifs = await api('GET', '/api/notifications?type=cancelled');
    log('20. 按类型查询通知', confirmedNotifs.success && cancelledNotifs.success ? '✅' : '❌', {
      confirmed: confirmedNotifs.data?.total,
      cancelled: cancelledNotifs.data?.total,
      waitlist: notifications.data?.list?.filter(n => n.type === 'waitlist').length,
      suspension: notifications2.data?.total
    });

    console.log('\n' + '='.repeat(60));
    console.log('测试总结:');
    console.log('='.repeat(60));
    results.forEach(r => {
      console.log(`${r.status} ${r.step}`);
    });

    const passed = results.filter(r => r.status === '✅').length;
    const total = results.length;
    console.log(`\n总计: ${passed}/${total} 通过`);

    if (passed === total) {
      console.log('\n🎉 所有测试通过！');
    } else {
      console.log(`\n⚠️  有 ${total - passed} 个测试失败`);
    }

    process.exit(passed === total ? 0 : 1);

  } catch (error) {
    console.error('测试执行出错:', error);
    process.exit(1);
  }
}

runTests();
