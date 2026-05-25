package io.whatif.heartbits.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BondStore(context: Context) {

    private val prefs = context.getSharedPreferences("heartbits", Context.MODE_PRIVATE)

    private val _roomId = MutableStateFlow(prefs.getString(KEY_ROOM_ID, null))
    val roomId: StateFlow<String?> = _roomId.asStateFlow()

    private val _partnerName = MutableStateFlow(prefs.getString(KEY_PARTNER_NAME, "") ?: "")
    val partnerName: StateFlow<String> = _partnerName.asStateFlow()

    val isBonded: Boolean get() = _roomId.value != null

    fun confirm(id: String) = persist(id, "")

    fun join(code: String, partnerName: String) = persist(canonicalize(code), partnerName)

    fun setPartnerName(name: String) {
        _partnerName.value = name
        prefs.edit().putString(KEY_PARTNER_NAME, name).apply()
    }

    fun unpair() {
        _roomId.value = null
        _partnerName.value = ""
        prefs.edit().remove(KEY_ROOM_ID).remove(KEY_PARTNER_NAME).apply()
    }

    private fun persist(id: String, name: String) {
        _roomId.value = id
        _partnerName.value = name
        prefs.edit()
            .putString(KEY_ROOM_ID, id)
            .putString(KEY_PARTNER_NAME, name)
            .apply()
    }

    private fun canonicalize(raw: String) =
        raw.uppercase().filter { it.isLetterOrDigit() }.take(8)

    companion object {
        private const val KEY_ROOM_ID = "hb.roomId"
        private const val KEY_PARTNER_NAME = "hb.partnerName"

        fun display(id: String): String =
            if (id.length >= 8) "${id.take(4)}·${id.takeLast(4)}" else id

        fun generateId(): String {
            val chars = "ABCDEFGHJKLMNPQRSTUVWXY3456789"
            return (0 until 8).map { chars.random() }.joinToString("")
        }
    }
}
