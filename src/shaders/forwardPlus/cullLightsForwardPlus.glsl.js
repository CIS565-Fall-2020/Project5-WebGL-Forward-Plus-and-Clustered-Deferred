import frustumUtils from '../include/frustum.glsl'
import lightingUtils from '../include/lighting.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

	uniform uint u_width;
	uniform uint u_height;
	uniform uint u_blockSize;
	uniform uint u_numLights;

	uniform mat4 u_viewMatrix;
	uniform float u_cameraRight;
	uniform float u_cameraUp;
	uniform float u_cameraNear;
	uniform float u_cameraFar;

	uniform sampler2D u_depthMin, u_depthMax;

	${lightingUtils}

	layout (std430, binding = 0) buffer LightIn {
		Light lights[];
	} lights;
	layout (std430, binding = 1) buffer LightList {
		ivec2 node[];
	} list;
	layout (std430, binding = 2) buffer LightHead {
		int head[];
	} head;

	${frustumUtils}

	void main() {
		uvec3 threadId = gl_GlobalInvocationID;
		uint numBlocksX = u_width / u_blockSize;
		uint numBlocksY = u_height / u_blockSize;
		if (threadId.x >= numBlocksX || threadId.y >= numBlocksY || threadId.z >= u_numLights) {
			return;
		}

		uint index = threadId.x + threadId.y * numBlocksX;

		uvec2 blockPos = u_blockSize * threadId.xy;

		float depthMin = texelFetch(u_depthMin, ivec2(threadId.xy), 0).x;
		float depthMax = texelFetch(u_depthMax, ivec2(threadId.xy), 0).x;
		depthMin = depthSampleToWorld(depthMin, u_cameraNear, u_cameraFar);
		depthMax = depthSampleToWorld(depthMax, u_cameraNear, u_cameraFar);

		Frustum frustum = computeFrustum(
			u_cameraRight, u_cameraUp, uvec2(u_width, u_height),
			blockPos, blockPos + uvec2(u_blockSize), depthMin, depthMax
		);

		vec3 lightPos = (u_viewMatrix * vec4(lights.lights[threadId.z].position, 1.0f)).xyz;
		lightPos.z = -lightPos.z;
		float lightRadius = lights.lights[threadId.z].radius;

		if (!frustumSphereIntersectionPossible(frustum, lightPos, lightRadius)) {
			return;
		}

		int node = atomicAdd(head.head[0], 1);
		int next = atomicExchange(head.head[index + 1u], node);
		list.node[node] = ivec2(threadId.z, next);
	}`;
}
