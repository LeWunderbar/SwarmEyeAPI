const express = require("express");
const axios = require("axios");
const config = require("./config.json");

const app = express();
const port = 5000; // API Port
const DOCKER_API_IPS = config.node_endpoints;

let currentApiIndex = 0;
let triedApis = new Set();

function getCurrentApiUrl() {
    return DOCKER_API_IPS[currentApiIndex];
}

function switchApi() {
    triedApis.add(currentApiIndex);
    currentApiIndex = (currentApiIndex + 1) % DOCKER_API_IPS.length;
}

// try all IPs in DOCKER_API_IPS until 1 is found that works. if none, Mark as down
async function tryNextApiUntilSuccess(func, ...args) {
    let lastError;
    triedApis.clear();
    while (triedApis.size < DOCKER_API_IPS.length) {
        try {
            return await func(...args);
        } catch (error) {
            console.warn(`Error with API at ${getCurrentApiUrl()}:`, error.message);
            lastError = error;
            switchApi();
        }
    }

    console.error("Cluster offline.");
    return res.status(503).json({ status: "down", reason: "Cluster Down!" });
}

async function getRunningTasksCount(serviceName) {
    const url = `${getCurrentApiUrl()}/tasks?filters=%7B%22service%22%3A%5B%22${serviceName}%22%5D%2C%22desired-state%22%3A%5B%22running%22%5D%7D`;
    const response = await axios.get(url);
    return response.data.length;
}

async function getServiceData(serviceName) {
    const serviceResponse = await axios.get(`${getCurrentApiUrl()}/services/${serviceName}`);
    return serviceResponse.data;
}

async function getActiveNodesCount() {
    const response = await axios.get(`${getCurrentApiUrl()}/nodes`);
    const nodes = response.data;
    const activeNodes = nodes.filter(node => 
        node.Status.State === 'ready' && 
        node.Spec.Availability === 'active'
    );
    return activeNodes.length;
}

app.get("/monitor/:serviceName", async (req, res) => {
    try {
        const serviceName = req.params.serviceName;

        const serviceData = await tryNextApiUntilSuccess(getServiceData, serviceName);

        if (serviceData === 0) {
            return res.status(500).json({ status: "error", reason: "Service Not Found!" });
        } else if (serviceData == null) {
            return res.status(500).json({ status: "error", reason: "Error fetching service data" });
        }

        const serviceMode = serviceData.Spec?.Mode ? Object.keys(serviceData.Spec.Mode)[0] : "Unknown";

        let wantedReplicas = null;
        let runningReplicas = await tryNextApiUntilSuccess(getRunningTasksCount, serviceName);

        if (runningReplicas == null) {
            return res.status(500).json({ status: "error", reason: "Error fetching running tasks!" });
        }

        if (serviceMode === "Unknown") {
            return res.status(500).json({ status: "error", reason: "Replication Mode not found!" });
        } else if (serviceMode === "Replicated") {
            wantedReplicas = serviceData.Spec?.Mode?.Replicated?.Replicas || 0;
        } else if (serviceMode === "Global") {
            wantedReplicas = await tryNextApiUntilSuccess(getActiveNodesCount);

            if (wantedReplicas == null) {
                return res.status(500).json({ status: "error", reason: "Error fetching nodes" });
            }
        }

        if (runningReplicas == 0) {
            return res.status(500).json({ status: "down" });
        }

        if (runningReplicas >= wantedReplicas) {
            return res.status(200).json({ status: "up" });
        } else {
            return res.status(503).json({ status: "down" });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ status: "error", reason: error.message });
    }
});

app.listen(port, () => {
    console.log(`Monitoring service running on port ${port}`);
});
