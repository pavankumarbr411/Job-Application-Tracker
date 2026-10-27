
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
    }

   
    post {
        success {
            sh '''
                set -eu

                COMMIT="$(git rev-parse HEAD)"
                REQUEST="/home/jenkins/agent/deploy-request.json"
                TEMP="/home/jenkins/agent/deploy-request.json.tmp"

                printf '{"commit":"%s"}\n' "$COMMIT" > "$TEMP"
                mv "$TEMP" "$REQUEST"

                echo "Deployment request created for commit: $COMMIT"
            '''

            echo 'JobTrack CI passed all checks and the deployment request was created.'
        }

        failure {
            echo 'JobTrack CI failed. No deployment request will be created.'
        }

        always {
            archiveArtifacts artifacts: 'frontend/dist/**',
                             allowEmptyArchive: true
        }
    }

}
