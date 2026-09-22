package com.swmansion.enriched.markdown

import android.content.Context
import com.facebook.react.bridge.JavaOnlyArray
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.uimanager.DisplayMetricsHolder
import com.facebook.yoga.YogaMeasureMode
import com.facebook.yoga.YogaMeasureOutput
import com.swmansion.enriched.markdown.parser.MarkdownASTNode
import com.swmansion.enriched.markdown.parser.MarkdownASTNode.NodeType
import com.swmansion.enriched.markdown.parser.Parser
import io.mockk.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

// Exercise the real Kotlin measurement/cache and Android text layout. Only the
// md4c JNI parser is replaced, since its Android .so cannot run in a host JVM.
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35])
class MeasurementStoreCacheTest {
  private lateinit var context: Context
  private lateinit var parser: Parser
  private val viewId = 101

  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(context)
    mockkObject(Parser.Companion)
    parser = mockk()
    every { Parser.shared } returns parser
    every { parser.parseMarkdown(any(), any()) } answers {
      MarkdownASTNode(NodeType.Document, children = listOf(
        MarkdownASTNode(NodeType.Paragraph, children = listOf(MarkdownASTNode(NodeType.Text, firstArg())))
      ))
    }
    MeasurementStore.release(viewId)
  }

  @After fun cleanup() {
    val failures = org.robolectric.shadows.ShadowLog.getLogs().filter { it.tag == "MeasurementStore" && it.type >= android.util.Log.WARN }
    assertTrue("The real split measurement must succeed, without fallback", failures.isEmpty())
    MeasurementStore.release(viewId)
    MeasurementStore.clearBreakStrategy(viewId)
    unmockkAll()
  }

  private fun convert(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> JavaOnlyMap.of(*value.keys().asSequence().flatMap { sequenceOf(it, convert(value.get(it))) }.toList().toTypedArray())
    is JSONArray -> JavaOnlyArray.from((0 until value.length()).map { convert(value.get(it)) })
    else -> value
  }

  private fun props(text: String = "A corridor and a door. ".repeat(30), fontSize: Double = 16.0): JavaOnlyMap {
    val styles = convert(JSONObject(File(requireNotNull(System.getProperty("noctalia.markdownFixture"))).readText())) as JavaOnlyMap
    (styles.getMap("paragraph") as JavaOnlyMap).putDouble("fontSize", fontSize)
    return JavaOnlyMap.of(
      "markdown", text, "markdownStyle", styles,
      "md4cFlags", JavaOnlyMap.of("latexMath", false),
      "streamingAnimation", false, "allowFontScaling", true
    )
  }

  private fun measure(p: JavaOnlyMap, width: Float = 300f, height: Float = 10000f) =
    MeasurementStore.getMeasureById(context, viewId, width, height, YogaMeasureMode.AT_MOST, p, true)

  @Test fun repeatedStaticTextUsesTheMeasuredSize() {
    val first = measure(props())
    assertTrue(YogaMeasureOutput.getHeight(first) > 0)
    assertEquals(first, measure(props()))
    verify(exactly = 1) { parser.parseMarkdown(any(), any()) }
  }

  @Test fun widthTextAndStyleChangesAreMeasuredAgain() {
    measure(props())
    measure(props(), width = 200f)
    measure(props("A changed dream."), width = 200f)
    measure(props("A changed dream.", 24.0), width = 200f)
    verify(exactly = 4) { parser.parseMarkdown(any(), any()) }
  }

  @Test fun dynamicGeometryInvalidationAndDisposalDoNotKeepStaleSizes() {
    val p = props()
    measure(p)
    MeasurementStore.invalidate(viewId)
    measure(p)
    MeasurementStore.release(viewId)
    measure(p)
    verify(exactly = 3) { parser.parseMarkdown(any(), any()) }
  }

  @Test fun changingBreakStrategyInvalidatesButAnIdenticalStrategyDoesNot() {
    val p = props()
    MeasurementStore.updateBreakStrategy(viewId, "simple")
    measure(p)
    MeasurementStore.updateBreakStrategy(viewId, "simple")
    measure(p)
    verify(exactly = 1) { parser.parseMarkdown(any(), any()) }
    MeasurementStore.updateBreakStrategy(viewId, "balanced")
    measure(p)
    verify(exactly = 2) { parser.parseMarkdown(any(), any()) }
  }

  @Test fun maximumHeightIsAppliedAfterReadingTheCache() {
    val p = props()
    val full = measure(p)
    val limited = measure(p, height = 10f)
    assertTrue(YogaMeasureOutput.getHeight(limited) < YogaMeasureOutput.getHeight(full))
    verify(exactly = 1) { parser.parseMarkdown(any(), any()) }
  }
  @Test fun fontScaleChangesInvalidateStaticMeasurements() {
    val p = props()
    measure(p)
    val configuration = android.content.res.Configuration(context.resources.configuration)
    configuration.fontScale = 1.5f
    context = context.createConfigurationContext(configuration)
    measure(p)
    verify(exactly = 2) { parser.parseMarkdown(any(), any()) }
  }

  @Test fun fontScalingLimitChangesInvalidateStaticMeasurements() {
    val p = props()
    measure(p)
    p.putDouble("maxFontSizeMultiplier", 1.3)
    measure(p)
    verify(exactly = 2) { parser.parseMarkdown(any(), any()) }
  }

}
