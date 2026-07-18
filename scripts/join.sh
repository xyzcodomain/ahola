#!/bin/bash

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Run:"
    echo "sudo ./join.sh <manager-ip>"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: sudo ./join.sh <manager-ip>"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "Docker not found. Install Docker first."
    exit 1
fi

MANAGER_IP="$1"
PANEL_URL="http://$MANAGER_IP:3333"
HOSTNAME=$(hostname)
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo "Requesting to join swarm from manager: $MANAGER_IP"

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"hostname\":\"$HOSTNAME\",\"localIp\":\"$LOCAL_IP\"}" \
    "$PANEL_URL/api/join-requests")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response: $BODY"

if [ "$HTTP_CODE" != "201" ]; then
    echo "Failed to send join request. HTTP code: $HTTP_CODE"
    exit 1
fi

REQUEST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REQUEST_ID" ]; then
    echo "Failed to get request ID from response."
    exit 1
fi

echo "Join request submitted. ID: $REQUEST_ID"
echo "Waiting for manager to accept..."

MAX_WAIT=300
WAITED=0
POLL_INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
    STATUS_RESPONSE=$(curl -s "$PANEL_URL/api/join-requests/$REQUEST_ID/status" 2>/dev/null || echo "")
    
    if [ -n "$STATUS_RESPONSE" ]; then
        STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$STATUS" = "accepted" ]; then
            TOKEN=$(echo "$STATUS_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            MANAGER_IP_FROM_RESPONSE=$(echo "$STATUS_RESPONSE" | grep -o '"managerIp":"[^"]*"' | cut -d'"' -f4)
            
            echo ""
            echo "Join request accepted!"
            echo "Manager IP: $MANAGER_IP_FROM_RESPONSE"
            echo "Token: $TOKEN"
            echo ""
            echo "Joining swarm..."
            
            docker swarm join \
                --token "$TOKEN" \
                "$MANAGER_IP_FROM_RESPONSE:2377"
            
            echo ""
            echo "Successfully joined the swarm!"
            exit 0
        elif [ "$STATUS" = "denied" ]; then
            echo "Join request denied by manager."
            exit 1
        fi
    fi
    
    echo "Waiting for approval... ($WAITED/$MAX_WAIT seconds)"
    sleep $POLL_INTERVAL
    WAITED=$((WAITED + POLL_INTERVAL))
done

echo "Timeout waiting for approval. Try again later."
exit 1
