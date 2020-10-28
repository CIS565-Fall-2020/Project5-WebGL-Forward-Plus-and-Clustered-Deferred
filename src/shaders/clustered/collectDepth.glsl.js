import frustumUtils from '../include/frustum.glsl'
import cluster from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform uint u_blockSizeX;
	uniform uint u_blockSizeY;
	uniform sampler2D u_depth;

	${frustumUtils}
	${cluster}

	layout (std430, binding = 0) buffer ClusterDepths {
		ClusterInfo values[];
	} clusterDepths;

	void main() {
		uvec2 pixelCoord = gl_GlobalInvocationID.xy;
		uvec2 clusterCoord = pixelCoord / uvec2(u_blockSizeX, u_blockSizeY);
		if (clusterCoord.x >= ${params.xSlices}u || clusterCoord.y >= ${params.ySlices}u) {
			return;
		}

		float depth = depthSampleToWorld(texelFetch(u_depth, ivec2(pixelCoord), 0).x, u_cameraNear, u_cameraFar);
		float depth01 = (depth - u_cameraNear) / (u_cameraFar - u_cameraNear);
		uint depthCluster = depth01ToDepthCluster(depth01, ${params.zSlices}u);
		if (depthCluster >= ${params.zSlices}u) {
			return;
		}

		uint clusterId = getClusterIndex(
			uvec3(clusterCoord.xy, depthCluster), ${params.xSlices}u, ${params.zSlices}u
		);
		int depthIntRepr = floatBitsToInt(depth);

		atomicMin(clusterDepths.values[clusterId].xMin, int(pixelCoord.x));
		atomicMax(clusterDepths.values[clusterId].xMax, int(pixelCoord.x));

		atomicMin(clusterDepths.values[clusterId].yMin, int(pixelCoord.y));
		atomicMax(clusterDepths.values[clusterId].yMax, int(pixelCoord.y));

		atomicMin(clusterDepths.values[clusterId].depthMin, depthIntRepr);
		atomicMax(clusterDepths.values[clusterId].depthMax, depthIntRepr);
	}
	`;
}
