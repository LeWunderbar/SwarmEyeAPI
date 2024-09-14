const express = require("express");
const axios = require("axios");
const config = require("./config.json")

const app = express();
const port = 5000; // API Port
const DOCKER_API_IPS = config.node_endpoints

let currentApiIndex = 0;

function getCurrentApiUrl() {
    return DOCKER_API_IPS[currentApiIndex];
}

function switchApi() {
    currentApiIndex = (currentApiIndex + 1) % DOCKER_API_IPS.length;
}

async function getRunningTasksCount(serviceName) {
    try {
        // URL Endpoint and Filter to get all tasks from Service with state "running" (running als includes healthy.)
        const url = `${getCurrentApiUrl()}/tasks?filters=%7B%22service%22%3A%5B%22${serviceName}%22%5D%2C%22desired-state%22%3A%5B%22running%22%5D%7D`;

        const response = await axios.get(url);
        const runningTasksCount = response.data.length;

        return runningTasksCount;
    } catch (error) {
        console.error('Error fetching running tasks:', error);
        return null
    }
}

async function getServiceData(serviceName) {
    try {
        const serviceResponse = await axios.get(`${getCurrentApiUrl()}/services/${serviceName}`);
        const serviceData = serviceResponse.data;
        
        return serviceData;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn('Service not found! Got:', serviceName);
            return 0
        } else {
            console.error('Error fetching service data:', error);
            return null
        }
    }
}

async function getActiveNodesCount() {
    try {
        const response = await axios.get(`${getCurrentApiUrl()}/nodes`);
        const nodes = response.data; // get all nodes as an array

        // Filter nodes that are online and in an active state, not in drain or pause state
        const activeNodes = nodes.filter(node => 
            node.Status.State === 'ready' && 
            node.Spec.Availability === 'active'
        )

        return activeNodes.length;
    } catch (error) {
        console.error('Error fetching nodes:', error);
        return null
    }
}

app.get("/monitor/:serviceName", async (req, res) => {
    try {
        const serviceName = req.params.serviceName;
        const serviceData = await getServiceData(serviceName, res);

        // getServiceData Error Responds
        if (serviceData === 0) {
            return res.status(500).json({ status: "error", reason: "Service Not Found!" });
        } else if (serviceData == null) {
            res.status(500).json({ status: "error", reason: "Error fetching service data" });
        }

        // get mode replication mode of service. (Global or Replicated)
        const serviceMode = serviceData.Spec?.Mode ? Object.keys(serviceData.Spec.Mode)[0] : "Unknown";

        let wantedReplicas = null;
        let runningReplicas = await getRunningTasksCount(serviceName);

        if (runningReplicas == null) {
            return res.status(500).json({ status: "error", reason: "Error fetching running tasks!" });
        }

        // getting wantedReplicas and runningReplicas based on serviceMode
        if (serviceMode === "Unknown") {
            console.warn("Replication Mode not found!", serviceMode);
            return res.status(500).json({ status: "error", reason: "Replication Mode not found!" });
        } else if (serviceMode === "Replicated") {
            wantedReplicas = serviceData.Spec?.Mode?.Replicated?.Replicas || 0;
        } else if (serviceMode === "Global") {
            wantedReplicas = await getActiveNodesCount();

            if (wantedReplicas == null) {
                return res.status(500).json({ status: "error", reason: "Error fetching nodes" });
            }
        } else {
            console.warn("Replication Mode not found!", serviceMode);
            return res.status(500).json({ status: "error", reason: "Replication Mode not found!" });
        }

        // Check if both vars got set correctly
        if (runningReplicas == null || wantedReplicas == null) {
            return res.status(500).json({ status: "error", reason: "Error getting counts!" });
        }

        // Checking if runningReplicas is more or equal to wantedReplicas (Up)
        if (runningReplicas >= wantedReplicas) {
            return res.status(200).json({ status: "up" });
        } else {
            return res.status(500).json({ status: "down" });
        }
    } catch (error) {
        console.error(error);

        //switchApi();
        //res.status(500).json({ status: "error", reason: "Internal Server Error" });
    }
});

app.listen(port, () => {
    console.log(`Monitoring service running on port ${port}`);
});