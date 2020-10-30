import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Frustum from './renderers/frustum';
import Scene from './scene';
import Wireframe from './wireframe';
import { vec3 } from 'gl-matrix';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();
var segmentColor = [1.0, 0.0, 0.0];

let frustumNear = [vec3.fromValues(-1.0,  1.0, 1.0),
                   vec3.fromValues( 1.0,  1.0, 1.0),
                   vec3.fromValues( 1.0, -1.0, 1.0),
                   vec3.fromValues(-1.0, -1.0, 1.0) ];

let frustumFar  = [vec3.fromValues(-2.0,  2.0, 2.0),
                   vec3.fromValues( 2.0,  2.0, 2.0),
                   vec3.fromValues( 2.0, -2.0, 2.0),
                   vec3.fromValues(-2.0, -2.0, 2.0) ];

let f = new Frustum(frustumNear, frustumFar);

console.log(f.intersectsSphere(vec3.fromValues(0, 7, 0), 1.0));

function visualizeFrustum(frustum) {
  // near face
  wireframe.addLineSegment(frustum.getTopLeftNear(), frustum.getTopRightNear(), segmentColor);
  wireframe.addLineSegment(frustum.getTopLeftNear(), frustum.getBottomLeftNear(), segmentColor);
  wireframe.addLineSegment(frustum.getTopRightNear(), frustum.getBottomRightNear(), segmentColor);
  wireframe.addLineSegment(frustum.getBottomLeftNear(), frustum.getBottomRightNear(), segmentColor);
  // back face
  wireframe.addLineSegment(frustum.getTopLeftFar(), frustum.getTopRightFar(), segmentColor);
  wireframe.addLineSegment(frustum.getTopLeftFar(), frustum.getBottomLeftFar(), segmentColor);
  wireframe.addLineSegment(frustum.getTopRightFar(), frustum.getBottomRightFar(), segmentColor);
  wireframe.addLineSegment(frustum.getBottomLeftFar(), frustum.getBottomRightFar(), segmentColor);
  // diagonals
  wireframe.addLineSegment(frustum.getTopLeftNear(), frustum.getTopLeftFar(), segmentColor);
  wireframe.addLineSegment(frustum.getTopRightNear(), frustum.getTopRightFar(), segmentColor);
  wireframe.addLineSegment(frustum.getBottomLeftNear(), frustum.getBottomLeftFar(), segmentColor);
  wireframe.addLineSegment(frustum.getBottomRightNear(), frustum.getBottomRightFar(), segmentColor);
}

let frustumsDrawn = false;

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  /*if(!frustumsDrawn && params.renderer == FORWARD_PLUS) {
    let frustums = params._renderer._frustums;
    for(let i = 0; i < frustums.length; i++) {
      visualizeFrustum(frustums[i]);
    }
    frustumsDrawn = true;
  }*/

  // Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  // the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();