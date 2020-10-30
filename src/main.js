import { makeRenderLoop, camera, cameraControls, gui, gl, canvas } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import { mat4, vec3 } from 'gl-matrix';

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

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

var segmentStart = [-14.0, 0.0, -6.0];
var segmentEnd = [14.0, 20.0, 6.0];
var segmentColor = [1.0, 0.0, 0.0];
wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 1.0]);

// create test frustum
var x_size = canvas.clientWidth / params._renderer._xSlices;
var y_size = canvas.clientHeight / params._renderer._ySlices;
var z_size = 500 / params._renderer._zSlices; // hardcode 200 - maybe change it later

// Frustum plane normals
//var nor_top = new Vector3(0, -1, 0);
//var nor_bottom = new Vector3(0, 1, 0);
//var nor_left = new Vector3(-1, 0, 0);
//var nor_right = new Vector3(1, 0, 0);
//var nor_near = new Vector3(0, 0, 1);
//var nor_far = new Vector3(0, 0, -1);

// Compute view and projection matrices
var view_translate = mat4.fromValues(1, 0, 0, 0,
                                  0, 1, 0, 0,
                                  0, 0, 1, 0,
                                  -camera.position.x, -camera.position.y, -camera.position.z, 1);
var look = vec3.normalize(vec3.fromValues(0, 0, 0), vec3.fromValues(cameraControls.target.x - camera.position.x, cameraControls.target.y - camera.position.y, cameraControls.target.z - camera.position.z));
var world_up = vec3.fromValues(0, 1, 0);
var right = vec3.cross(vec3.fromValues(0, 0, 0), look, world_up); // camera's right vector
var up = vec3.cross(vec3.fromValues(0, 0, 0), right, look); // camera's up vector
var view_orient = mat4.fromValues(right[0], up[0], look[0], 0,
                                  right[1], up[1], look[1], 0,
                                  right[2], up[2], look[2], 0,
                                  0, 0, 0, 1);

var view_mat = mat4.multiply(mat4.create(), view_orient, view_translate);
var proj_mat = mat4.fromValues(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[1], camera.projectionMatrix.elements[2], camera.projectionMatrix.elements[3],
                               camera.projectionMatrix.elements[4], camera.projectionMatrix.elements[5], camera.projectionMatrix.elements[6], camera.projectionMatrix.elements[7],
                               camera.projectionMatrix.elements[8], camera.projectionMatrix.elements[9], camera.projectionMatrix.elements[10], camera.projectionMatrix.elements[11],
                               camera.projectionMatrix.elements[12], camera.projectionMatrix.elements[13], camera.projectionMatrix.elements[14], camera.projectionMatrix.elements[15]);
/*var proj_mat = mat4.fromValues(1.0 / (camera.aspect * Math.tan(camera.fov / 2)), 0, 0, 0,
                               0, 1.0 / Math.tan(camera.fov / 2), 0, 0,
                               0, 0, camera.far / (camera.far - camera.near), 1.0,
                               0, 0, -(camera.far * camera.near) / (camera.far - camera.near), 0);*/
var view_proj = mat4.multiply(mat4.create(), proj_mat, view_mat);
for (let z = -(params._renderer._zSlices / 2) * z_size; z < (params._renderer._zSlices / 2) * z_size - z_size; z += z_size) {
  for (let y = -(params._renderer._ySlices / 2) * y_size; y < (params._renderer._ySlices / 2) * y_size - y_size; y += y_size) {
    for (let x = -(params._renderer._xSlices / 2) * x_size; x < (params._renderer._xSlices / 2) * x_size - x_size; x += x_size) {
      // bottom edges
      var segment0 = vec3.fromValues(x, y, z);
      var segment1 = vec3.fromValues(x, y, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x + x_size, y, z);
      segment1 = vec3.fromValues(x + x_size, y, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x, y, z);
      segment1 = vec3.fromValues(x + x_size, y, z);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x, y, z + z_size);
      segment1 = vec3.fromValues(x + x_size, y, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      
      // sides
      segment0 = vec3.fromValues(x, y, z);
      segment1 = vec3.fromValues(x, y + y_size, z);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x, y, z + z_size);
      segment1 = vec3.fromValues(x, y + y_size, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x + x_size, y, z);
      segment1 = vec3.fromValues(x + x_size, y + y_size, z);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x + x_size, y, z + z_size);
      segment1 = vec3.fromValues(x + x_size, y + y_size, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);

      // top edges
      segment0 = vec3.fromValues(x, y + y_size, z);
      segment1 = vec3.fromValues(x, y + y_size, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x + x_size, y + y_size, z);
      segment1 = vec3.fromValues(x + x_size, y + y_size, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x, y + y_size, z);
      segment1 = vec3.fromValues(x + x_size, y + y_size, z);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
      segment0 = vec3.fromValues(x, y + y_size, z + z_size);
      segment1 = vec3.fromValues(x + x_size, y + y_size, z + z_size);
      //segment0 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment0, view_proj);
      //segment1 = vec3.transformMat4(vec3.fromValues(0, 0, 0), segment1, view_proj);
      wireframe.addLineSegment([segment0[0], segment0[1], segment0[2]], [segment1[0], segment1[1], segment1[2]], [0.0, 1.0, 0.0]);
    }
  }
}

gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();