package io.whatif.heartbits.relay

import io.whatif.heartbits.data.HeartBit

interface HeartBitRelay {
    fun subscribe(onMessage: (HeartBit) -> Unit, onConnectionChange: (Boolean) -> Unit = {})
    fun send(heartBit: HeartBit)
    fun disconnect()
}
