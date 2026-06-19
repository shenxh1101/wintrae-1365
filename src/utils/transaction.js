import mongoose from 'mongoose';

export async function withTransaction(operation) {
  const session = await mongoose.startSession();

  try {
    let result;

    try {
      session.startTransaction();
      result = await operation(session);
      await session.commitTransaction();
    } catch (txError) {
      if (txError.message.includes('Transaction numbers are only allowed')) {
        await session.abortTransaction();
        session.endSession();
        result = await operation(null);
        return result;
      }
      throw txError;
    }

    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session && session.id) {
      try {
        session.endSession();
      } catch (e) {}
    }
  }
}

export async function withSession(session, operation) {
  if (session) {
    return operation(session);
  }
  return operation();
}
