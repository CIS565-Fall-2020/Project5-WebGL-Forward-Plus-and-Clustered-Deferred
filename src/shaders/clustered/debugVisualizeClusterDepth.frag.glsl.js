import frustumUtils from '../include/frustum.glsl'
import clusterUtils from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform float u_depthLayer;
	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform sampler2D u_depth;

	${frustumUtils}
	${clusterUtils}

	layout (std430, binding = 0) buffer ClusterDepths {
		ClusterInfo values[];
	} clusterDepths;

	out vec4 fragColor;

	void main() {
		uvec2 fragCoord = uvec2(gl_FragCoord.xy);
		uvec2 clusterXY = fragCoord / uvec2(${params.blockSizeX}, ${params.blockSizeY});
		uint depthSlice = min(depth01ToDepthCluster(u_depthLayer, ${params.zSlices}u), ${params.zSlices}u - 1u);
		float depth = u_depthLayer * (u_cameraFar - u_cameraNear) + u_cameraNear;

		uint clusterIndex = getClusterIndex(uvec3(clusterXY, depthSlice), ${params.xSlices}u, ${params.zSlices}u);
		ClusterInfo cluster = clusterDepths.values[clusterIndex];

		float depthMin = 0.0f;
		float depthMax = 0.0f;
		if (cluster.xMin <= cluster.xMax) {
			depthMin = intBitsToFloat(cluster.depthMin);
			depthMax = intBitsToFloat(cluster.depthMax);
		}
		fragColor = vec4(depthMax, depthMin, 0.0f, 1.0f);

		ivec2 xy = ivec2(fragCoord);
		fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
		uvec2 inClusterCoord = fragCoord - clusterXY * uvec2(${params.blockSizeX}, ${params.blockSizeY});
		if (cluster.xMin <= cluster.xMax) {
			fragColor.x = 1.0f;
		}
		if (
			xy.x >= cluster.xMin && xy.x <= cluster.xMax &&
			xy.y >= cluster.yMin && xy.y <= cluster.yMax &&
			depth >= intBitsToFloat(cluster.depthMin) && depth <= intBitsToFloat(cluster.depthMax)
		) {
			fragColor.y = 1.0f;
		}
		float sceneDepth = depthSampleToWorld(
			texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x, u_cameraNear, u_cameraFar
		);
		fragColor.z = (sceneDepth - u_cameraNear) / (u_cameraFar - u_cameraNear);
		if (inClusterCoord.x == 0u || inClusterCoord.y == 0u) {
			fragColor.z = 1.0f;
		}
	}
	`;
}
