import TextureBuffer from './textureBuffer';

import { Frustum, Plane, Vector2, Vector3 } from '../../node_modules/three/build/three'
import { mat2, vec2 } from 'gl-matrix';
import { mat3, vec3 } from 'gl-matrix';
import { mat4, vec4 } from 'gl-matrix';
import { Sphere } from '../../node_modules/three/build/three'

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._firstCall = true;
  }

  sliceSpaceToWorldSpace(distance, viewProjectionMatrixInverse, pointSliceSpace) {   
    // Transform to normalized device coordinate  (homogenized)
    var pointNDC = vec4.create()
    pointNDC[0] = (pointSliceSpace[0] / this._xSlices) * 2.0 - 1;
    pointNDC[1] = 1.0 - (pointSliceSpace[1] / this._xSlices) * 2.0;
    pointNDC[2] = 1;
    pointNDC[3] = 1;

    // Transform to world space
    var pointNonNDC = vec4.create()
    vec4.scale(pointNonNDC, pointNDC, distance);

    var pointWorldSpace = vec4.create()
    vec4.transformMat4(pointWorldSpace, pointNonNDC, viewProjectionMatrixInverse);

    var pointWorldSpaceVec3 = vec3.create();
    pointWorldSpaceVec3[0] = pointWorldSpace[0]
    pointWorldSpaceVec3[1] = pointWorldSpace[1]
    pointWorldSpaceVec3[2] = pointWorldSpace[2]
    return pointWorldSpaceVec3;
  }

  getPlaneFrom3Points(point0, point1, point2) {
    var v10 = vec3.create();
    var v12 = vec3.create();
    vec3.subtract(v10, point0, point1);
    vec3.subtract(v12, point2, point1);
   
    // normal: the normal of the plane (normalized)
    var normal = vec3.create();
    vec3.cross(normal, v10, v12);
    vec3.normalize(normal, normal);

    // constant: the distance from the origin to the plane
    var constant = Math.abs(normal[0] * point1[0] + normal[1] * point1[1] + normal[2] * point1[2]); // this is d in ax + by + cz + d = 0
    
    var plane = new Plane(new Vector3(normal[0], normal[1], normal[2]), constant);
    return plane;
  }

  updateClusters(camera, viewMatrix, scene) {
    // Create inverse of view projection matrix
   var viewMatrixInverse = mat4.create();
   mat4.invert(viewMatrixInverse, viewMatrix);

   var projectionMatrixInverse = mat4.create();
   mat4.invert(projectionMatrixInverse, camera.projectionMatrix.elements);

   var viewProjectionMatrixInverse = mat4.create();
   mat4.multiply(viewProjectionMatrixInverse, viewMatrixInverse, projectionMatrixInverse);

   // Other variables stays the same across all loops
   var resolution = vec2.create();
   resolution[0] = canvas.width;
   resolution[1] = canvas.height;
   var numSlices = vec3.create();
   numSlices[0] = this._xSlices;
   numSlices[1] = this._ySlices;
   numSlices[2] = this._zSlices;

   // height and width of a 2d slice in terms of pixels
   var sliceDimension = vec2.create();
   sliceDimension[0] = resolution[0] / this._xSlices;
   sliceDimension[1] = resolution[1] / this._ySlices;
   
   var perSliceDistance = (camera.far - camera.near) / this._zSlices;

   // TODO: DELETE Test only
   var points = [];
   for (let z = 0; z < this._zSlices; ++z) {
     for (let y = 0; y < this._ySlices; ++y) {
       for (let x = 0; x < this._xSlices; ++x) {

         let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
         
         // Reset the light count to 0 for every cluster
         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
         
         // Find the 8 points of the frustum
         var pointFarUpLeft = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * (z + 1), viewProjectionMatrixInverse, [x, y, z + 1]);
         var pointFarUpRight = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * (z + 1), viewProjectionMatrixInverse, [x + 1, y, z + 1]);
         var pointFarDownRight = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * (z + 1), viewProjectionMatrixInverse, [x + 1, y + 1, z + 1]);
         var pointFarDownLeft = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * (z + 1), viewProjectionMatrixInverse, [x, y + 1, z + 1]);

         var pointNearUpLeft = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * z, viewProjectionMatrixInverse, [x, y, z]);
         var pointNearUpRight = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * z, viewProjectionMatrixInverse, [x + 1, y, z]);
         var pointNearDownRight = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * z, viewProjectionMatrixInverse, [x + 1, y + 1, z]);
         var pointNearDownLeft = this.sliceSpaceToWorldSpace(camera.near + perSliceDistance * z, viewProjectionMatrixInverse, [x, y + 1, z]);

         // TEST ONLY _ DELETE
        //  if (this._firstCall) {
        //   points.push(pointFarUpLeft);
        //   points.push(pointFarUpRight);
        //   points.push(pointFarUpLeft);
        //   points.push(pointFarDownLeft);
        //   points.push(pointFarDownLeft);
        //   points.push(pointFarDownRight);
 
        //   points.push(pointNearUpLeft);
        //   points.push(pointFarUpLeft);
        //   points.push(pointNearUpRight);
        //   points.push(pointFarUpRight);
        //   points.push(pointNearDownLeft);
        //   points.push(pointFarDownLeft);
        //   points.push(pointNearDownRight);
        //   points.push(pointFarDownRight); 
        //  }

         // Create 6 planes out of these points making a frustum
         var planeFar = this.getPlaneFrom3Points(pointFarUpRight, pointFarUpLeft, pointFarDownLeft); // normal faces away from cam
         var planeNear = this.getPlaneFrom3Points(pointNearDownLeft, pointNearUpLeft, pointNearUpRight);// normal faces towards cam
         var planeLeft = this.getPlaneFrom3Points(pointFarUpLeft, pointNearUpLeft, pointNearDownLeft); // normal faces to the left
         var planeRight = this.getPlaneFrom3Points(pointNearDownRight, pointNearUpRight, pointFarUpRight); // normal faces to the right
         var planeUp = this.getPlaneFrom3Points(pointNearUpRight, pointNearUpLeft, pointFarUpLeft); // normal faces up
         var planeDown = this.getPlaneFrom3Points(pointFarDownLeft, pointNearDownLeft, pointNearDownRight); // normal faces down

         // // Create a frustum out of the planes
         var frustum = new Frustum(planeFar, planeNear, planeLeft, planeRight, planeUp, planeDown);
         var lightsInfluenceFrustum = [];
         // Iterates through all the lights to see which light intersects with this frustum (treat lights as point lights)
         for (let lightIndex = 0; lightIndex < scene.lights.length; ++lightIndex) {
           if (lightsInfluenceFrustum.length >= MAX_LIGHTS_PER_CLUSTER) {
             break;
           }

           var light = scene.lights[lightIndex];
           var lightPos = new Vector3(light.position[0], light.position[1], light.position[2]);
           var lightSphere = new Sphere(lightPos, light.radius);
           
           if (frustum.intersectsSphere(lightSphere)) {
             lightsInfluenceFrustum.push(lightIndex)
           }
         }

         var row = 0;
         var component = 1;
         for (let j = 0; j < lightsInfluenceFrustum.length; j++) {
           this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + component] = lightsInfluenceFrustum[j];
           if (component > 4) {
             row++;
             component = 0;
           }           
         }
         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightsInfluenceFrustum.length;
       }
     }
   }
   this._firstCall = false;
   this._clusterTexture.update();
   return points;
  }
}