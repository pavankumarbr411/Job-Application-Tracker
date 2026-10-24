
pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate Environment') {
            steps {
                sh 'echo "Jenkins Linux agent is working"'
                sh 'git --version'
            }
        }

        stage('Check Project Files') {
            steps {
                sh 'test -f backend/requirements.txt'
                sh 'test -f frontend/package.json'
                sh 'test -f docker-compose.yml'
                sh 'echo "Required project files found"'
            }
        }
    }
}
