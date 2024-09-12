const express = require('express');
const axios = require('axios');

const app = express();
const port = 5000; // Port for your monitoring service

// Array of Docker API IPs
const DOCKER_API_IPS = [
    'http://192.168.178.188:4243',
    'http://192.168.178.154:4243',
];

let currentApiIndex = 0;

function getCurrentApiUrl() {
    return DOCKER_API_IPS[currentApiIndex];
}

function switchApi() {
    currentApiIndex = (currentApiIndex + 1) % DOCKER_API_IPS.length;
}

app.get('/monitor/:serviceName', async (req, res) => {
    const serviceName = req.params.serviceName;
    const serviceUrl = `${getCurrentApiUrl()}/services/${serviceName}`;
    const tasksUrl = `${getCurrentApiUrl()}/services/${serviceName}/tasks`;

    try {
        const serviceResponse = await axios.get(serviceUrl);
        const serviceData = serviceResponse.data;

        const replicas = serviceData.Spec?.Mode?.Replicated?.Replicas || 0;
        if (replicas === 0) {
            return res.status(500).json({ status: 'down', reason: 'Service scaled to 0' });
        }

        const tasksResponse = await axios.get(tasksUrl);
        const tasksData = tasksResponse.data;

        let restartLoopDetected = false;
        tasksData.forEach(task => {
            const desiredState = task.DesiredState;
            const currentState = task.Status?.State;
            const restartCount = task.RestartCount || 0;

            if ((currentState === 'failed' || currentState === 'restarting') && restartCount > 3) {
                restartLoopDetected = true;
            }
        });

        if (restartLoopDetected) {
            return res.status(500).json({ status: 'down', reason: 'Service stuck in restart loop' });
        }

        return res.status(200).json({ status: 'up' });
    
    } catch (error) {
        switchApi();
        try {
            const serviceResponse = await axios.get(serviceUrl);
            const serviceData = serviceResponse.data;
            const replicas = serviceData.Spec?.Mode?.Replicated?.Replicas || 0;

            if (replicas === 0) {
                return res.status(500).json({ status: 'down', reason: 'Service scaled to 0' });
            }

            const tasksResponse = await axios.get(tasksUrl);
            const tasksData = tasksResponse.data;
            let restartLoopDetected = false;
            
            tasksData.forEach(task => {
                const desiredState = task.DesiredState;
                const currentState = task.Status?.State;
                const restartCount = task.RestartCount || 0;

                if ((currentState === 'failed' || currentState === 'restarting') && restartCount > 3) {
                    restartLoopDetected = true;
                }
            });

            if (restartLoopDetected) {
                return res.status(500).json({ status: 'down', reason: 'Service stuck in restart loop' });
            }

            return res.status(200).json({ status: 'up' });
        } catch (secondError) {
            return res.status(500).json({ status: 'down', error: secondError.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Monitoring service running on port ${port}`);
});
