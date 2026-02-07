package com.solanamobile.mobilewalletadapter.capacitor

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.solana.mobilewalletadapter.clientlib.protocol.JsonRpc20Client
import com.solana.mobilewalletadapter.clientlib.protocol.MobileWalletAdapterClient
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationIntentCreator
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationScenario
import org.json.JSONObject
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

@CapacitorPlugin(name = "SolanaMobileWalletAdapterModule", requestCodes = [0])
class SolanaMobileWalletAdapterModule: Plugin(), CoroutineScope {

    data class SessionState(
        val client: MobileWalletAdapterClient,
        val localAssociation: LocalAssociationScenario,
    )

    override val coroutineContext =
        Dispatchers.IO + CoroutineName("SolanaMobileWalletAdapterModuleScope") + SupervisorJob()

    companion object {
        private const val ASSOCIATION_TIMEOUT_MS = 10000
        private const val CLIENT_TIMEOUT_MS = 90000
        private const val REQUEST_LOCAL_ASSOCIATION = 0

        // Used to ensure that you can't start more than one session at a time.
        private val mutex: Mutex = Mutex()
        private var sessionState: SessionState? = null
    }

    private val mActivityEventCallbacks = mutableMapOf<Int, (Int, Intent?) -> (Unit)>()

    @Deprecated("Deprecated")
    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        Log.d(getName(), "handle requestCode $requestCode with data: ${data?.data}")

        mActivityEventCallbacks[requestCode]?.let { callback ->
            callback(resultCode, data)
            mActivityEventCallbacks.remove(requestCode)
        }
    }

    private fun getName(): String {
        return "SolanaMobileWalletAdapter"
    }

    @PluginMethod
    fun startSession(call: PluginCall) = launch {
        mutex.lock()

        Log.d(getName(), "startSession with config ${call.data}")

        try {
            val uriPrefix = call.getString("baseUri")?.let { Uri.parse(it) }
            val localAssociation = LocalAssociationScenario(CLIENT_TIMEOUT_MS)
            val intent = LocalAssociationIntentCreator.createAssociationIntent(
                uriPrefix,
                localAssociation.port,
                localAssociation.session
            )

            launchIntent(intent, REQUEST_LOCAL_ASSOCIATION) { resultCode, _ ->
                if (resultCode == Activity.RESULT_CANCELED) {
                    Log.d(getName(), "Local association cancelled by user, ending session")
                    call.reject("Session not established: Local association cancelled by user",
                        LocalAssociationScenario.ConnectionFailedException("Local association cancelled by user"))
                    localAssociation.close()
                }
            }

            val client = localAssociation.start().get(ASSOCIATION_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
            sessionState = SessionState(client, localAssociation)
            call.resolve()
        } catch (e: ActivityNotFoundException) {
            Log.e(getName(), "Found no installed wallet that supports the mobile wallet protocol", e)
            cleanup()
            call.reject("ERROR_WALLET_NOT_FOUND", e)
        } catch (e: TimeoutException) {
            Log.e(getName(), "Timed out waiting for local association to be ready", e)
            cleanup()
            call.reject("Timed out waiting for local association to be ready", e)
        } catch (e: InterruptedException) {
            Log.w(getName(), "Interrupted while waiting for local association to be ready", e)
            cleanup()
            call.reject("Interrupted while waiting for local association to be ready", e)
        } catch (e: ExecutionException) {
            Log.e(getName(), "Failed establishing local association with wallet", e.cause)
            cleanup()
            call.reject("Failed establishing local association with wallet", e)
        } catch (e: Throwable) {
            Log.e(getName(), "Failed to start session", e)
            cleanup()
            call.reject("Failed to start session", e.message)
        }
    }

    @PluginMethod
    fun invoke(call: PluginCall) = sessionState?.let {
        val method = call.getString("method", "unknown")!!
        val params = call.getObject("params")
        try {
            Log.d(getName(), "invoke `$method` with params $params")
            val result = JSObject.fromJSONObject(
                it.client.methodCall(method, params, CLIENT_TIMEOUT_MS).get() as JSONObject
            )
            call.resolve(result)
        } catch (e: ExecutionException) {
            val cause = e.cause
            if (cause is JsonRpc20Client.JsonRpc20RemoteException) {
                val userInfo = JSObject()
                userInfo.put("jsonRpcErrorCode", cause.code)
                call.reject("JSON_RPC_ERROR", cause, userInfo)
            } else {
                throw e
            }
        } catch (e: Throwable) {
            Log.e(getName(), "Failed to invoke `$method` with params $params", e)
            call.reject("Failed to invoke `$method` with params $params", e.message)
        }
    } ?: throw NullPointerException("Tried to invoke `${call.getString("method")}` without an active session")

    @PluginMethod
    fun endSession(call: PluginCall) = sessionState?.let {
        launch {
            Log.d(getName(), "endSession")
            try {
                it.localAssociation.close().get(ASSOCIATION_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
                cleanup()
                call.resolve()
            } catch (e: TimeoutException) {
                Log.e(getName(), "Timed out waiting for local association to close", e)
                cleanup()
                call.reject("Failed to end session", e)
            } catch (e: Throwable) {
                Log.e(getName(), "Failed to end session", e)
                cleanup()
                call.reject("Failed to end session", e.message)
            }
        }
    } ?: throw NullPointerException("Tried to end a session without an active session")

    private fun launchIntent(intent: Intent, requestCode: Int, callback: (Int, Intent?) -> (Unit)) {
        mActivityEventCallbacks[requestCode] = callback

        bridge?.activity?.startActivityForResult(intent, REQUEST_LOCAL_ASSOCIATION) ?: run {
            mActivityEventCallbacks.remove(requestCode)
            throw NullPointerException("Could not find a current activity from which to launch a local association")
        }
    }

    private fun cleanup() {
        sessionState = null
        if (mutex.isLocked) {
            mutex.unlock()
        }
    }
}
