import frustumUtils from '../include/frustum.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

	${frustumUtils}

	uniform uint u_blockSizeX;
	uniform uint u_blockSizeY;
	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform sampler2D u_depth;

	layout (std430, binding = 0) buffer ClusterDepths {
		ivec2 values[];
	} clusterDepths;

	void main() {
		uvec2 fragCoord = gl_GlobalInvocationID.xy / uvec2(u_blockSizeX, u_blockSizeY);
		if (fragCoord.x >= ${params.xSlices}u || fragCoord.y >= ${params.ySlices}u) {
			return;
		}
		uint clusterIndex = fragCoord.y * ${params.xSlices}u + fragCoord.x;

		float depth = texelFetch(u_depth, ivec2(gl_GlobalInvocationID.xy), 0).x;
		depth = depthSampleToWorld(depth, u_cameraNear, u_cameraFar);
		int depthInt = floatBitsToInt(depth);
		atomicMin(clusterDepths.values[clusterIndex].x, depthInt);
		atomicMax(clusterDepths.values[clusterIndex].y, depthInt);
	}
	`;
}
