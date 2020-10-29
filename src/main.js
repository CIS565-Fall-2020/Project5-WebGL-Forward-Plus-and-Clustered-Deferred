import { makeRenderLoop, camera, cameraControls, gui, gl, canvas } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import OrbitControls from 'three-orbitcontrols';
import { Vector3, Plane, PerspectiveCamera, Frustum, Sphere } from 'three';


const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';

const params = {
  renderer: CLUSTERED,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(16, 16, 16);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(16, 16, 16);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
cameraControls.update();
const wireframe = new Wireframe();

// var segmentStart = [0.0, 0.0, 0.0];
// var segmentEnd = [14.0, 20.0, 6.0];
// var segmentColor = [1.0, 0.0, 0.0];
// wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);


var testCamera = new PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
var testCameraControls = new OrbitControls(testCamera, canvas);
cameraControls.enableDamping = true;
cameraControls.enableZoom = true;
cameraControls.rotateSpeed = 0.3;
cameraControls.zoomSpeed = 1.0;
cameraControls.panSpeed = 2.0;
testCamera.position.set(-10, 8, 0);
testCameraControls.target.set(0, 2, 0);
testCameraControls.update();


var look = new Vector3(0,0,-1);
var up = new Vector3(0,1,0);
var right = new Vector3(1,0,0);
look.applyQuaternion(camera.quaternion).normalize();
up.applyQuaternion(camera.quaternion).normalize();
right.applyQuaternion(camera.quaternion).normalize();

var numPlanesX = Math.floor(16/2);
var numPlanesY = Math.floor(16/2);
var numPlanesZ = 5;

var maxDist = 30;
var distSep = maxDist/numPlanesZ;

var faces = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane(), new Plane()]
var frust = new Frustum();

var blockSize = distSep;
// for(var k = 0; k < numPlanesZ; k++) {
//   var d = camera.near + (k * distSep);
//   var frustumHeight = 2.0 * d * Math.tan(camera.fov * 0.5 * (Math.PI/180)) * 0.5;
//   var frustumWidth = frustumHeight * camera.aspect;
//   var bfrustumHeight = 2.0 * (d+blockSize) * Math.tan(camera.fov * 0.5 * (Math.PI/180)) * 0.5;
//   var bfrustumWidth = bfrustumHeight * camera.aspect;

//   for(var i = -numPlanesX; i < numPlanesX; i++) {
//     for(var j = -numPlanesY; j < numPlanesY; j++) {

//       // Front Face
//       var tx = new Vector3().copy(right).multiplyScalar(frustumWidth).multiplyScalar((i+1)/numPlanesX);
//       var ty = new Vector3().copy(up).multiplyScalar(frustumHeight).multiplyScalar((j+1)/numPlanesY);
//       var ur = new Vector3().copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i+1)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j)/numPlanesY);
//       var lr = new Vector3().copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j)/numPlanesY);
//       var ll = new Vector3().copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j+1)/numPlanesY);
//       var ul = new Vector3().copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);

//       // Back Face
//       var tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i+1)/numPlanesX);
//       var ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j+1)/numPlanesY);
//       var bur = new Vector3().copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i+1)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j)/numPlanesY);
//       var blr = new Vector3().copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j)/numPlanesY);
//       var bll = new Vector3().copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
    
//       tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i)/numPlanesX);
//       ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j+1)/numPlanesY);
//       var bul = new Vector3().copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
      
//       var centroid = new Vector3().set(0,0,0).add(ur).add(lr).add(ul).add(ll).add(bur).add(blr).add(bul).add(bll);
//       centroid.multiplyScalar(1/8);
//       var outside = new Vector3(0,0,0).add(bul).add(bll).add(blr).add(bur).multiplyScalar(1/4).add(look);

//       faces[0].setFromCoplanarPoints(ur, lr, ll);
//       faces[1].setFromCoplanarPoints(blr, bur, bll);
//       faces[2].setFromCoplanarPoints(ul, ll, bll);
//       faces[3].setFromCoplanarPoints(lr, ur, blr);
//       faces[4].setFromCoplanarPoints(ur, ul, bur);
//       faces[5].setFromCoplanarPoints(ll, lr, blr);

//       frust.set(faces[0], faces[1], faces[2], faces[3], faces[4], faces[5])
//       var sp = new Sphere(centroid, 0.0001);

//       var ds = [0, 0, 0, 0, 0, 0];
//       for (var r = 0; r < 6; r++) {
//         ds[r] = faces[r].normal.dot(centroid) + faces[r].constant;
//       }

//       wireframe.addLineSegment(ll.toArray(), ul.toArray(), [0,1,0]);
//       wireframe.addLineSegment(ll.toArray(), lr.toArray(), [0,1,0]);
//       wireframe.addLineSegment(ul.toArray(), ur.toArray(), [0,1,0]);
//       wireframe.addLineSegment(ur.toArray(), lr.toArray(), [0,1,0]);

//       wireframe.addLineSegment(bll.toArray(), bul.toArray(), [1,0,0]);
//       wireframe.addLineSegment(bll.toArray(), blr.toArray(), [1,0,0]);
//       wireframe.addLineSegment(bul.toArray(), bur.toArray(), [1,0,0]);
//       wireframe.addLineSegment(bur.toArray(), blr.toArray(), [1,0,0]);

//       wireframe.addLineSegment(bll.toArray(), ll.toArray(), [0,0,1]);
//       wireframe.addLineSegment(blr.toArray(), lr.toArray(), [0,0,1]);
//       wireframe.addLineSegment(bul.toArray(), ul.toArray(), [0,0,1]);
//       wireframe.addLineSegment(bur.toArray(), ur.toArray(), [0,0,1]);
//     }
//   }
// }



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