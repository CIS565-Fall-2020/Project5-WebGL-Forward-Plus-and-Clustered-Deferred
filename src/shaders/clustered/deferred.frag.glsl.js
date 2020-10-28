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


	vec3 sobelNorm(sampler2D tex, ivec2 xy) {
		vec3
			x00 = texelFetch(tex, xy + ivec2(-1, -1), 0).xyz,
			x01 = texelFetch(tex, xy + ivec2(-1,  0), 0).xyz,
			x02 = texelFetch(tex, xy + ivec2(-1,  1), 0).xyz,
			x10 = texelFetch(tex, xy + ivec2( 0, -1), 0).xyz,
			x11 = texelFetch(tex, xy + ivec2( 0,  0), 0).xyz,
			x12 = texelFetch(tex, xy + ivec2( 0,  1), 0).xyz,
			x20 = texelFetch(tex, xy + ivec2( 1, -1), 0).xyz,
			x21 = texelFetch(tex, xy + ivec2( 1,  0), 0).xyz,
			x22 = texelFetch(tex, xy + ivec2( 1,  1), 0).xyz;
		vec3
			x = x00 + 2.0f * x10 + x20 - (x02 + 2.0f * x12 + x22),
			y = x00 + 2.0f * x01 + x02 - (x20 + 2.0f * x21 + x22);
		return sqrt(x * x + y * y);
	}

	float sobelDepth(sampler2D tex, ivec2 xy, float camNear, float camFar) {
		float
			x00 = depthSampleToWorld(texelFetch(tex, xy + ivec2(-1, -1), 0).x, camNear, camFar),
			x01 = depthSampleToWorld(texelFetch(tex, xy + ivec2(-1,  0), 0).x, camNear, camFar),
			x02 = depthSampleToWorld(texelFetch(tex, xy + ivec2(-1,  1), 0).x, camNear, camFar),
			x10 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 0, -1), 0).x, camNear, camFar),
			x11 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 0,  0), 0).x, camNear, camFar),
			x12 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 0,  1), 0).x, camNear, camFar),
			x20 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 1, -1), 0).x, camNear, camFar),
			x21 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 1,  0), 0).x, camNear, camFar),
			x22 = depthSampleToWorld(texelFetch(tex, xy + ivec2( 1,  1), 0).x, camNear, camFar);
		float
			x = x00 + 2.0f * x10 + x20 - (x02 + 2.0f * x12 + x22),
			y = x00 + 2.0f * x01 + x02 - (x20 + 2.0f * x21 + x22);
		return sqrt(x * x + y * y);
	}

	vec3 toon(
		vec3 colorIn, uint steps,
		uvec2 fragCoord, sampler2D normalTex, sampler2D depthTex,
		float camNear, float camFar,
		float normalWeight, float depthWeight,
		float edgeThresholdMin, float edgeThresholdMax
	) {
		colorIn = floor(colorIn * (float(steps) - 0.01f)) / float(steps);

		vec3 normal = normalWeight * sobelNorm(normalTex, ivec2(fragCoord));
		float depth = depthWeight * sobelDepth(depthTex, ivec2(fragCoord), camNear, camFar);
		float diff = length(normal) + depth;
		colorIn = mix(colorIn, vec3(0.0f), smoothstep(edgeThresholdMin, edgeThresholdMax, diff));

		return colorIn;
	}

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
		for (int i = head.head[clusterIndex]; i != -1; i = list.node[i].y) {
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
		} else if (u_debugMode == 3) {
			fragColor.xyz = toon(
				fragColor.xyz, 3u, fragCoord,
				u_gbuffers[0], u_depth,
				u_cameraNear, u_cameraFar,
				0.4f, 0.3f,
				u_debugModeParam - 0.5f, u_debugModeParam
			);
		}
	}
	`;
}
