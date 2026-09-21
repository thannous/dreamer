package com.swmansion.worklets

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.ReactChoreographer
import com.facebook.soloader.SoLoader
import com.swmansion.worklets.runloop.AnimationFrameCallback
import io.mockk.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implements
import org.robolectric.annotation.Implementation

// JNI scheduler construction cannot execute on a host JVM. The lifecycle module
// and AnimationFrameQueue are real; only JNI and the device choreographer are replaced.
@Implements(AndroidUIScheduler::class, isInAndroidSdk = false)
class ShadowUIScheduler {
  @Implementation fun __constructor__(context: ReactApplicationContext) {}
  @Implementation fun deactivate() {}
}

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35], shadows = [ShadowUIScheduler::class])
class WorkletsLifecycleTest {
  private lateinit var context: ReactApplicationContext
  private lateinit var choreographer: ReactChoreographer
  private lateinit var module: WorkletsModule

  @Before fun setup() {
    mockkStatic(SoLoader::class)
    every { SoLoader.loadLibrary(any()) } returns true
    context = mockk(relaxed = true)
    choreographer = mockk(relaxed = true)
    mockkObject(ReactChoreographer.Companion)
    every { ReactChoreographer.getInstance() } returns choreographer
    module = WorkletsModule(context)
  }

  @After fun cleanup() { unmockkAll() }

  @Test fun registersForHostLifecycleAndUnregistersOnlyOnce() {
    module.initialize()
    verify(exactly = 1) { context.addLifecycleEventListener(module) }
    module.invalidate()
    module.invalidate()
    verify(exactly = 1) { context.removeLifecycleEventListener(module) }
  }

  @Test fun pauseDisarmsPendingFramesAndResumeRearmsThem() {
    module.initialize()
    module.requestAnimationFrame(mockk<AnimationFrameCallback>())
    verify(exactly = 1) { choreographer.postFrameCallback(any(), any()) }
    module.onHostPause()
    verify(exactly = 1) { choreographer.removeFrameCallback(any(), any()) }
    module.requestAnimationFrame(mockk<AnimationFrameCallback>())
    verify(exactly = 1) { choreographer.postFrameCallback(any(), any()) }
    module.onHostResume()
    module.onHostResume()
    verify(exactly = 2) { choreographer.postFrameCallback(any(), any()) }
  }

  @Test fun invalidationPreventsLateResumeFromRestartingTheLoop() {
    module.initialize()
    module.requestAnimationFrame(mockk<AnimationFrameCallback>())
    module.onHostPause()
    module.invalidate()
    module.onHostResume()
    module.onHostPause()
    verify(exactly = 1) { choreographer.postFrameCallback(any(), any()) }
    verify(exactly = 1) { choreographer.removeFrameCallback(any(), any()) }
  }
}
