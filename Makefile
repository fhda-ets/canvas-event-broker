# Lookup up branch name
export CURRENT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

# Get a timestamp for right now
export DATE_NOW := $(shell date +%F.%H%M%S)

# Set Docker repository name
export ECR_REPO_NAME := canvas-event-broker

# Set the stack name
export STACK_NAME := docker-$(ECR_REPO_NAME)-$(CURRENT_BRANCH)

# Generate an image tag
export IMAGE_TAG := 794167933507.dkr.ecr.us-west-2.amazonaws.com/$(ECR_REPO_NAME):$(CURRENT_BRANCH)-$(DATE_NOW)

cf-deploy:
	# Validate CloudFormation template
	@echo "Validating template cf-stack.yml"
	@aws cloudformation validate-template \
		--template-body file://aws/cf-stack.yml

	# Deploy CloudFormation stack
	@echo Deploying stack $(STACK_NAME)
	@aws cloudformation deploy \
		--stack-name $(STACK_NAME) \
		--template-file aws/cf-stack.yml \
		--parameter-overrides DockerImageTag="`cat .lastimage`" GitBranch="$(CURRENT_BRANCH)"
	@echo Deployment completed successfully

docker-image:
	# Build Docker image
	@echo "$(IMAGE_TAG)" > .lastimage
	@docker build -f docker/Dockerfile -t $(IMAGE_TAG) .
	@docker push $(IMAGE_TAG)

ecr-repository:
	@aws ecr create-repository --repository-name $(ECR_REPO_NAME)

image-tag:
	@echo "$(IMAGE_TAG)"