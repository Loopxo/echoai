package ai.echoai.android.ui

import androidx.compose.runtime.Composable
import ai.echoai.android.MainViewModel
import ai.echoai.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
