import * as THREE from "three-platformize";
import { WechatPlatform as BaseWechatPlatform } from "three-platformize/src/WechatPlatform/index.js";
import { GLTFLoader } from "three-platformize/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three-platformize/examples/jsm/controls/OrbitControls.js";

function createTwoDimensionalCanvas(width = 1, height = 1) {
  let canvas = null;
  if (typeof wx !== "undefined" && wx.createOffscreenCanvas) {
    try {
      canvas = wx.createOffscreenCanvas({ type: "2d", width, height });
    } catch (_) {
      canvas = null;
    }
    if (!canvas) {
      try {
        canvas = wx.createOffscreenCanvas();
      } catch (_) {
        canvas = null;
      }
    }
  }
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

class WechatPlatform extends BaseWechatPlatform {
  constructor(canvas, width, height) {
    super(canvas, width, height);
    const hostCanvas = canvas;
    this.document.createElementNS = (_, type) => {
      if (type === "canvas") return createTwoDimensionalCanvas(width, height) || hostCanvas;
      if (type === "img") return hostCanvas.createImage();
      return {};
    };
  }

  getGlobals() {
    const globals = super.getGlobals();
    return {
      ...globals,
      OffscreenCanvas: function OffscreenCanvas(width = 1, height = 1) {
        return createTwoDimensionalCanvas(width, height);
      },
    };
  }
}

export { GLTFLoader, OrbitControls, THREE, WechatPlatform };
