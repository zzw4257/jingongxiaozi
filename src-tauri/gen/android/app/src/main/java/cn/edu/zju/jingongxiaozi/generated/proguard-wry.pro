# THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!!

# Copyright 2020-2023 Tauri Programme within The Commons Conservancy
# SPDX-License-Identifier: Apache-2.0
# SPDX-License-Identifier: MIT

-keep class cn.edu.zju.jingongxiaozi.* {
  native <methods>;
}

-keep class cn.edu.zju.jingongxiaozi.WryActivity {
  public <init>(...);

  void setWebView(cn.edu.zju.jingongxiaozi.RustWebView);
  java.lang.Class getAppClass(...);
  int getId();
  java.lang.String getVersion();
  int startActivity(...);
}

-keep class cn.edu.zju.jingongxiaozi.Ipc {
  public <init>(...);

  @android.webkit.JavascriptInterface public <methods>;
}

-keep class cn.edu.zju.jingongxiaozi.RustWebView {
  public <init>(...);

  void loadUrlMainThread(...);
  void loadHTMLMainThread(...);
  void evalScript(...);
}

-keep class cn.edu.zju.jingongxiaozi.RustWebChromeClient,cn.edu.zju.jingongxiaozi.RustWebViewClient {
  public <init>(...);
}
