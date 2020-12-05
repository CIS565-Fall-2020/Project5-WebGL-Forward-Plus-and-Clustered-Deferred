import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
export const CLUSTERED = 'Clustered Deferred';
export const CLUSTERED_BLINN_PHONG = 'Clustered Deferred - Blinn-Phong';
export const CLUSTERED_TOON = 'Clustered Deferred - Toon';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  if (renderer == FORWARD) {
    params._renderer = new ForwardRenderer();
  } else if (renderer == FORWARD_PLUS) {
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
  } else { // Variations of clustered
    params._renderer = new ClusteredDeferredRenderer(15, 15, 15, renderer);   
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED, CLUSTERED_BLINN_PHONG, CLUSTERED_TOON]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

// var segmentStart = [-14.0, 0.0, -6.0];
// var segmentEnd = [14.0, 20.0, 6.0];
// var segmentColor = [1.0, 0.0, 0.0];
// wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
// wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  var points = params._renderer.render(camera, scene);

  // for (let i = 0; i < points.length; i++) {
  //    wireframe.addLineSegment(points[i], points[i + 1], [1.0, 0.0, 0.0]);
  //    i += 1;
  // }
 // wireframe.addLineSegment(points[0], points[1], [1.0, 0.0, 0.0]);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();