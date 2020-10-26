import cluster from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform float u_depthLayer;

	${cluster}

	layout (std430, binding = 0) buffer ClusterDepths {
		ClusterInfo values[];
	} clusterDepths;

	out vec4 fragColor;

	void main() {
		uvec2 fragCoord = uvec2(gl_FragCoord.xy);
		uvec2 clusterXY = fragCoord / uvec2(${params.blockSizeX}, ${params.blockSizeY});
		uint depthSlice = min(uint(u_depthLayer * float(${params.zSlices})), ${params.zSlices}u - 1u);

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
			xy.y >= cluster.yMin && xy.y <= cluster.yMax
		) {
			fragColor.y = 1.0f;
		}
		if (inClusterCoord.x == 0u || inClusterCoord.y == 0u) {
			fragColor.z = 1.0f;
		}
	}
	`;
}
