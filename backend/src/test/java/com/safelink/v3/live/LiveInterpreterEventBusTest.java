package com.safelink.v3.live;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.mockito.Mockito.*;

class LiveInterpreterEventBusTest {
    @AfterEach void clear() { TransactionSynchronizationManager.clear(); }

    @Test void notificationWaitsForCommitAndPublishesOnlyOnce() {
        var bus=spy(new LiveInterpreterEventBus());
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        bus.publishAfterCommit("translations:2","broadcast-start","payload");
        verify(bus,never()).publish(anyString(),anyString(),any());
        var callbacks=TransactionSynchronizationManager.getSynchronizations();
        callbacks.forEach(callback -> callback.afterCommit());
        verify(bus,times(1)).publish("translations:2","broadcast-start","payload");
        // publish() called from existing afterCommit hooks must not register another hook.
        org.junit.jupiter.api.Assertions.assertEquals(1,TransactionSynchronizationManager.getSynchronizations().size());
    }

    @Test void rollbackDoesNotNotifyAndNontransactionalCallsRemainImmediate() {
        var bus=spy(new LiveInterpreterEventBus());
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        bus.publishAfterCommit("translations:2","broadcast-start","payload");
        TransactionSynchronizationManager.getSynchronizations().forEach(callback -> callback.afterCompletion(1));
        verify(bus,never()).publish(anyString(),anyString(),any());
        TransactionSynchronizationManager.clear();
        bus.publishAfterCommit("translations:2","broadcast-start","payload");
        verify(bus).publish("translations:2","broadcast-start","payload");
    }
}
