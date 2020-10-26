import frustumUtils from '../include/frustum.glsl'
import lightingUtils from '../include/lighting.glsl'
import clusterUtils from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	${frustumUtils}
	${lightingUtils}
	${clusterUtils}

	layout (std430, binding = 0) buffer LightIn {
		Light lights[];
	} lights;
	layout (std430, binding = 1) buffer LightHead {
		int head[];
	} head;
	layout (std430, binding = 2) buffer LightList {
		ivec2 node[];
	} list;

	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform float u_cameraRight;
	uniform float u_cameraUp;
	uniform mat4 u_invView;

	uniform uint u_blockSizeX;
	uniform uint u_blockSizeY;

	uniform int u_debugMode;
	uniform float u_debugModeParam;

	uniform sampler2D u_gbuffers[${params.numGBuffers}];
	uniform sampler2D u_depth;

	in vec2 v_uv;

	out vec4 fragColor;

	void main() {
		uvec2 fragCoord = uvec2(gl_FragCoord.xy);
		vec3 normal = texelFetch(u_gbuffers[0], ivec2(fragCoord), 0).xyz;
		vec3 albedo = texelFetch(u_gbuffers[1], ivec2(fragCoord), 0).xyz;

		float depth = texelFetch(u_depth, ivec2(fragCoord), 0).x;
		depth = depthSampleToWorld(depth, u_cameraNear, u_cameraFar);
		float depth01 = (depth - u_cameraNear) / (u_cameraFar - u_cameraNear);
		uint clusterDepth = depth01ToDepthCluster(depth01, ${params.zSlices}u);
		uvec3 clusterPos = uvec3(fragCoord / uvec2(u_blockSizeX, u_blockSizeY), clusterDepth);
		uint clusterIndex = getClusterIndex(clusterPos, ${params.xSlices}u, ${params.zSlices}u);

		vec3 worldPos = vec3((v_uv * 2.0f - 1.0f) * vec2(u_cameraRight, u_cameraUp), 1.0f);
		worldPos *= depth;
		worldPos = (u_invView * vec4(worldPos.xy, -worldPos.z, 1.0f)).xyz;

		fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
		int count = 0;
		for (int i = head.head[clusterIndex + 1u]; i != -1; i = list.node[i].y) {
			Light light = lights.lights[list.node[i].x];
			float lightDistance = distance(light.position, worldPos);
			vec3 L = (light.position - worldPos) / lightDistance;

			float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
			float lambertTerm = max(dot(L, normal), 0.0);

			fragColor.xyz += albedo * lambertTerm * light.color * vec3(lightIntensity);
			count += 1;
		}

		const vec3 ambientLight = vec3(0.025);
		fragColor.xyz += albedo * ambientLight;
		if (u_debugMode == 2) {
			fragColor.xyz = mix(
				vec3(0.0f, 0.0f, 1.0f),
				vec3(1.0f, 0.0f, 0.0f),
				float(count) / (u_debugModeParam * 1000.0f + 1.0f)
			);
		}
	}
	`;
}
