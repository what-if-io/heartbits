package io.whatif.heartbits.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.whatif.heartbits.data.HeartBit
import io.whatif.heartbits.haptics.HapticEngine
import io.whatif.heartbits.relay.HeartBitRelay
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HeartBitsViewModel(
    private val relay: HeartBitRelay,
    private val senderAddress: String,
    private val recipientAddress: String,
    private val hapticEngine: HapticEngine
) : ViewModel() {

    enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

    private val _myBPM = MutableStateFlow(0.0)
    val myBPM: StateFlow<Double> = _myBPM.asStateFlow()

    private val _isBeating = MutableStateFlow(false)
    val isBeating: StateFlow<Boolean> = _isBeating.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private val _partnerBPM = MutableStateFlow(0.0)
    val partnerBPM: StateFlow<Double> = _partnerBPM.asStateFlow()

    private val _lastReceived = MutableStateFlow<Long?>(null)
    val lastReceived: StateFlow<Long?> = _lastReceived.asStateFlow()

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    var partnerName: String = ""

    fun startSending() {
        if (_isSending.value) return
        _isSending.value = true
        _connectionState.value = ConnectionState.CONNECTING
        relay.subscribe(
            onMessage = { heartBit -> onReceiveHeartBit(heartBit) },
            onConnectionChange = { connected ->
                viewModelScope.launch {
                    _connectionState.value =
                        if (connected) ConnectionState.CONNECTED else ConnectionState.CONNECTING
                }
            }
        )
    }

    fun onReceiveHeartRate(bpm: Double) {
        _myBPM.value = bpm
        triggerBeat()
        if (!_isSending.value) return
        relay.send(HeartBit.fromBPM(bpm, senderAddress, recipientAddress))
    }

    private fun onReceiveHeartBit(heartBit: HeartBit) {
        viewModelScope.launch {
            _connectionState.value = ConnectionState.CONNECTED
            _partnerBPM.value = heartBit.bpm
            _lastReceived.value = System.currentTimeMillis()
            hapticEngine.playBeat(heartBit.rrIntervalMs)
            triggerBeat()
        }
    }

    private fun triggerBeat() {
        viewModelScope.launch {
            _isBeating.value = true
            delay(200)
            _isBeating.value = false
        }
    }

    fun tearDown() {
        relay.disconnect()
        _isSending.value = false
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    override fun onCleared() {
        tearDown()
        super.onCleared()
    }

    class Factory(
        private val relay: HeartBitRelay,
        private val senderAddress: String,
        private val recipientAddress: String,
        private val hapticEngine: HapticEngine
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            HeartBitsViewModel(relay, senderAddress, recipientAddress, hapticEngine) as T
    }
}
