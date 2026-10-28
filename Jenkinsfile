
pipeline {
    agent {
        label 'jobtrack-build'
    }

    options {
        timestamps()
        skipDefaultCheckout(true)
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate Environment') {
            steps {
                sh 'git --version'
                sh 'node --version'
                sh 'npm --version'
                sh 'python3 --version'
            }
        }

        stage('Check Project Files') {
            steps {
                sh 'test -f backend/requirements.txt'
                sh 'test -f backend/tests/conftest.py'
                sh 'test -f frontend/package.json'
                sh 'test -f frontend/package-lock.json'
                sh 'test -f docker-compose.yml'

                echo 'Required project files found'
            }
        }

        stage('Frontend Install') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Tests') {
            steps {
                dir('frontend') {
                    sh 'npm run test:run'
                }
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Frontend Production Build') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Backend Tests') {
            steps {
                dir('backend') {
                    sh 'python3 -m venv .venv'
                    sh '.venv/bin/python -m pip install --upgrade pip'
                    sh '.venv/bin/python -m pip install -r requirements.txt'
                    sh '.venv/bin/python -m pytest -v --cov=. --cov-report=term-missing'
                }
            }
        }

        stage('Deployment Approval') {
            steps {
                script {
                    def approval = input(
                        message: 'All CI checks passed. Approve JobTrack deployment?',
                        ok: 'Approve Deployment',
                        submitterParameter: 'DEPLOY_APPROVER',
                        parameters: []
                    )

                    def approver = approval instanceof Map
                        ? approval.get('DEPLOY_APPROVER')
                        : approval

                    if (!approver?.toString()?.trim()) {
                        error(
                            'Deployment cancelled: approver identity is missing.'
                        )
                    }

                    env.DEPLOY_APPROVED_BY =
                        approver.toString().trim()

                    echo "Deployment approved by: ${env.DEPLOY_APPROVED_BY}"
                }
            }
        }


        stage('Deploy to AWS EC2') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'jobtrack-ec2-ssh',
                        keyFileVariable: 'EC2_SSH_KEY',
                        usernameVariable: 'EC2_SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu

                        COMMIT="$(git rev-parse HEAD)"

                        echo "Deploying approved commit: $COMMIT"

                        ssh \
                          -i "$EC2_SSH_KEY" \
                          -o BatchMode=yes \
                          -o ConnectTimeout=10 \
                          -o StrictHostKeyChecking=yes \
                          "$EC2_SSH_USER@54.153.219.122" \
                          "bash -s -- '$COMMIT'" <<'REMOTE_SCRIPT'
set -eu

COMMIT="$1"
APP_DIR="/home/ubuntu/JobTrack/app"

case "$COMMIT" in
    *[!0-9a-f]*|'')
        echo "ERROR: Invalid commit SHA"
        exit 1
        ;;
esac

if [ "${#COMMIT}" -ne 40 ]; then
    echo "ERROR: Expected a full 40-character commit SHA"
    exit 1
fi

cd "$APP_DIR"

git fetch origin "$COMMIT"
git checkout --detach "$COMMIT"

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file /home/ubuntu/jobtrack.env \
    config --quiet

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file /home/ubuntu/jobtrack.env \
    up -d --build

echo "Waiting for JobTrack frontend..."

for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error \
        http://127.0.0.1/ -o /dev/null 2>/dev/null; then
        echo "Deployment health check passed."
        exit 0
    fi

    sleep 2
done

echo "ERROR: Frontend health check failed."
docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file /home/ubuntu/jobtrack.env \
    ps

exit 1
REMOTE_SCRIPT
                    '''
                }
            }
        }

    }

    post {
        success {
            sh '''
                set -eu

                COMMIT="$(git rev-parse HEAD)"
                APPROVER="${DEPLOY_APPROVED_BY:-}"

                if [ -z "$APPROVER" ]; then
                    echo "ERROR: No deployment approver recorded."
                    exit 1
                fi

                REQUEST="/home/jenkins/agent/deploy-request.json"
                TEMP="/home/jenkins/agent/deploy-request.json.tmp"

                export COMMIT APPROVER
                export TEMP_FILE="$TEMP"

                python3 -c '
import json
import os

request = {
    "commit": os.environ["COMMIT"],
    "approvedBy": os.environ["APPROVER"]
}

with open(os.environ["TEMP_FILE"], "w") as f:
    json.dump(request, f)
    f.write("\\n")
'

                mv "$TEMP" "$REQUEST"

                echo "Approved deployment request created for commit: $COMMIT"
                echo "Approver: $APPROVER"
            '''

            echo 'JobTrack CI passed all checks and the deployment request was created.'
        }

        failure {
            echo 'JobTrack CI failed or was aborted. No new deployment request will be created.'
        }

        always {
            archiveArtifacts(
                artifacts: 'frontend/dist/**',
                allowEmptyArchive: true
            )
        }
    }
}

