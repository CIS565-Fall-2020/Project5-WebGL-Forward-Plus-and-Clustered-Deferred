import matplotlib.pyplot as plt

fig, ax = plt.subplots()

numLights = [100, 150, 200, 250, 300]
forwardFPS = [27, 18, 13, 11, 9]
forwardPlusFPS = [33, 25, 18, 21, 12]
deferredFPS = [53, 38, 35, 36, 23]

plt.plot(numLights, forwardFPS, label="Forward")
plt.plot(numLights, forwardPlusFPS, label="Forward+")
plt.plot(numLights, deferredFPS, label="Deferred clustered")

plt.title("Rendering speed comparison for different number of lights")
plt.xlabel("Number of lights in the scene")
plt.ylabel("FPS")
plt.legend()
plt.show()