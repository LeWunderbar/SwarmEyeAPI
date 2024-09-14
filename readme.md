# SwarmEye API

SwarmEye API is a wrapper for the Docker API that allows you to monitor the status of Docker Swarm services based on their replication status.

## Notes:
- This API **only works** for Docker Swarm clusters, as services are unique to Docker's Swarm mode.
- For services in **Global replication mode**, all replicas must be running for the service to be recognized as "UP."
- For services using **standard replication mode**, at least one replica must be running for the service to be considered "UP."

## API Usage:
http://localhost:5000/monitor/ServiceName

### Responses:
- **Up:**  
  Status code: `200`  
  Response: `{"status":"up"}`
  
- **Down:**  
  Status code: `503`  
  Response: `{"status": "down", "reason": "Reasoning"}`
  
- **Error:**  
  Status code: `500`  
  Response: `{"status": "error", "reason": "Reasoning/Error"}`

## Enabling Docker API for Each Node:

1. Open the `docker.service` file by navigating to `/lib/systemd/system` and running the following command:
`sudo nano /lib/systemd/system/docker.service`

2. In this file, locate the line starting with `ExecStart` and modify it by adding `-H=tcp://0.0.0.0:4243`. It should look like this:

`ExecStart=/usr/bin/dockerd -H=fd:// -H=tcp://0.0.0.0:4243`

3. Save the file and reload the Docker daemon:
`sudo systemctl daemon-reload`

4. Restart the Docker service:
`sudo service docker restart`

5. Test if the Docker API is working:
`curl http://localhost:4243/version`

6. Add the API endpoint to the `config.json` file under the `"node_endpoints"` section.