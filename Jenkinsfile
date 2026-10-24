
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

        stage('Validate Project Files') {
            steps {
                powershell 'git --version'
                powershell 'python --version'
                powershell 'node --version'
                powershell 'npm --version'
            }
        }
    }
}
