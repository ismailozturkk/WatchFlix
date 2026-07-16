package com.smlztrk.Watchify.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ReminderWidgetPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(ReminderWidgetModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
