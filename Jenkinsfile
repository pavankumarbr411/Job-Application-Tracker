
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
                sh 'test -f docker-compose.prod.yml'

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
ENV_FILE="/home/ubuntu/jobtrack.env"

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

# Remember the currently deployed source revision.
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "Previous revision: $PREVIOUS_COMMIT"
echo "Target revision:   $COMMIT"

# Fetch the approved revision from GitHub.
git fetch origin main

git cat-file -e "$COMMIT^{commit}" || {
    echo "ERROR: Approved commit is not available locally."
    exit 1
}

# Restore the previous revision if deployment fails.
rollback_deployment() {
    echo "Attempting rollback to $PREVIOUS_COMMIT"

    git checkout --detach "$PREVIOUS_COMMIT" || return 1

    docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        --env-file "$ENV_FILE" \
        config --quiet || return 1

    docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        --env-file "$ENV_FILE" \
        up -d --build || return 1

    for attempt in $(seq 1 30); do
        if curl --fail --silent \
            http://127.0.0.1/ -o /dev/null; then
            echo "Previous revision restored successfully."
            return 0
        fi

        sleep 2
    done

    echo "ERROR: Rollback health check failed."
    return 1
}

# Select the exact commit that passed CI.
git checkout --detach "$COMMIT"

# Validate before touching running services.
if ! docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    config --quiet; then

    echo "ERROR: Production configuration is invalid."
    git checkout --detach "$PREVIOUS_COMMIT"
    exit 1
fi

# Build and start the new version.
if ! docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    up -d --build; then

    echo "ERROR: Deployment command failed."

    if ! rollback_deployment; then
        echo "CRITICAL: Automatic rollback failed. Manual recovery is required."
    fi

    exit 1
fi

# Verify that the frontend responds.
echo "Checking JobTrack frontend..."

HEALTHY=0

for attempt in $(seq 1 30); do
    if curl --fail --silent \
        http://127.0.0.1/ -o /dev/null; then
        HEALTHY=1
        break
    fi

    sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
    echo "ERROR: New deployment failed its health check."

    if ! rollback_deployment; then
        echo "CRITICAL: Automatic rollback failed. Manual recovery is required."
    fi

    exit 1
fi

echo "Deployment health check passed."
echo "Successfully deployed revision: $COMMIT"
REMOTE_SCRIPT
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'JobTrack CI passed and the approved deployment completed successfully.'
            echo "Deployment approver: ${env.DEPLOY_APPROVED_BY}"
        }

        failure {
            echo 'JobTrack pipeline failed. Check the console output and deployment recovery messages.'
        }

        aborted {
            echo 'JobTrack pipeline was aborted. Check whether deployment had already started.'
        }

        always {
            archiveArtifacts(
                artifacts: 'frontend/dist/**',
                allowEmptyArchive: true
            )
        }
    }
}
