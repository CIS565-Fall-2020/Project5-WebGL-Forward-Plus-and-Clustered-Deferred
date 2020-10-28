import frustumUtils from '../include/frustum.glsl'
import lightingUtils from '../include/lighting.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

	uniform uint u_width;
	uniform uint u_height;
	uniform uint u_blockSizeX;
	uniform uint u_blockSizeY;
	uniform uint u_numLights;

	uniform mat4 u_viewMatrix;
	uniform float u_cameraRight;
	uniform float u_cameraUp;

	${lightingUtils}
	${frustumUtils}

	layout (std430, binding = 0) buffer ClusterDepths {
		ivec2 values[];
	} clusterDepths;
	layout (std430, binding = 1) buffer LightIn {
		Light lights[];
	} lights;
	layout (std430, binding = 2) buffer LightList {
		ivec2 node[];
	} list;
	layout (std430, binding = 3) buffer LightHead {
		int head[];
	} head;
	layout (binding = 4) uniform atomic_uint u_numNodes;


	void main() {
		uvec3 threadId = gl_GlobalInvocationID;
		if (threadId.x >= ${params.xSlices}u || threadId.y >= ${params.ySlices}u || threadId.z >= u_numLights) {
			return;
		}

		uint index = threadId.x + threadId.y * ${params.xSlices}u;

		uvec2 blockPos = uvec2(u_blockSizeX, u_blockSizeY) * threadId.xy;

		float depthMin = intBitsToFloat(clusterDepths.values[index].x);
		float depthMax = intBitsToFloat(clusterDepths.values[index].y);

		Frustum frustum = computeFrustum(
			u_cameraRight, u_cameraUp, uvec2(u_width, u_height),
			blockPos, blockPos + uvec2(u_blockSizeX, u_blockSizeY), depthMin, depthMax
		);

		vec3 lightPos = (u_viewMatrix * vec4(lights.lights[threadId.z].position, 1.0f)).xyz;
		lightPos.z = -lightPos.z;
		float lightRadius = lights.lights[threadId.z].radius;

		if (!frustumSphereIntersectionPossible(frustum, lightPos, lightRadius)) {
			return;
		}

		int node = int(atomicCounterIncrement(u_numNodes));
		if (node < ${params.lightListSize}) {
			int next = atomicExchange(head.head[index], node);
			list.node[node] = ivec2(threadId.z, next);
		}
	}`;
}
