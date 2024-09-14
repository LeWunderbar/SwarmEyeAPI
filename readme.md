An API to get infomation if an Docker Swarm Service is down or up

API usage:
http://localhost:5000/monitor/ServiceName

Responds:
Up: 200 {"status":"up"}
Down: 503 {"status": "down", "reason": "Reasoning"}
Error: 500 {"status": "error", "reason": "Reasoning/Error"}

Enable Docker API for each node:
1: Navigate to /lib/systemd/system in your terminal and open docker.service file
   sudo nano /lib/systemd/system/docker.service

2: Save the file

3: Find the line which starts with ExecStart and adds -H=tcp://0.0.0.0:4243 to make it look like
   ExecStart=/usr/bin/dockerd -H=fd:// -H=tcp://0.0.0.0:4243

4: Reload the docker daemon using the below command
   sudo systemctl daemon-reload

5: Restart the docker service using the below command
   sudo service docker restart

6: Test if working:
   curl http://localhost:4243/version

7: Add to config.json file under "node_endpoints".

* You can change the port to whatever you want. just make sure it reachable.
