# Getting started with smartFinder
SmartFinder is a project designed to bridge the gap in document search and accessibility. Its goal is to provide an intelligent, efficient, and user-friendly solution for locating documents quickly and effectively


## Setup Instructions

Follow these steps to set up and run the project on your local machine.

### 1. **Create a Virtual Environment**
To begin, create and activate a virtual environment for the project.

#### For Linux/macOS:
```bash
python3 -m venv venv
source venv/bin/activate
```
#### For Windows:
```bash
python -m venv venv
venv\Scripts\activate
```
### 2. Set up the Environment File
Create an .env file in the root directory of the project to store your environment variables. Here’s an example of what it might look like:

env
```
ELASTICSEARCH_HOST=your_elasticsearch_host
ELASTICSEARCH_PASSWORD=your_elasticsearch_password
ELASTICSEARCH_USER=your_elasticsearch_user
GENERATIVE_AI_KEY=your_openai_key
```
Replace your_elasticsearch_host, your_elasticsearch_password, your_elasticsearch_user, and your_openai_key with the actual values for your Elasticsearch setup and the Generative AI key.

### 3. Install Required Python Libraries
Once your virtual environment is activated, install the necessary dependencies using requirements.txt.

```bash
pip install -r requirements.txt
```
This will install all the necessary Python packages.

### 4. Install Frontend Dependencies
Navigate to the frontend folder named smartfinder, by using the comand "cd smartfinder" and install the required npm packages:

```bash
npm install
```
### 5. Install Sentence-Transformers
If you haven’t installed sentence-transformers already, do so with:

```bash
pip install sentence-transformers
```
This is required for semantic search functionality.

### 6. Set Up Elasticsearch and Kibana Containers
You'll need to run Elasticsearch and Kibana in Docker containers. For docker you can either use docker cli or install on your PC
Follow this on how to create and run elastic search and kibana containers  
link: https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html


#### Activate the Trial License (for additional features)
To access additional features in Elasticsearch and Kibana, you'll need to activate the trial license:
We need this because we will be working with machine learning models for semantic search. This can either be done on kibana when ypu've gain access to the website or on the command line using the following command;
```bash
curl -X POST "localhost:9200/_license/start_trial?acknowledge=true" -u elastic:your_elasticsearch_password
```


#### 7. Copy SSL/TLS Certificate
Once you've set up elastic search, copy the certificate to the project directory replacing the existing certificate with yours.

#### 8. Set Up the Generative AI Key
Still in the .env file, replace the "your api key" with your generated geminia api key from android studio

Your env file should look like this

env
```
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PASSWORD=your_password
ELASTICSEARCH_USER=your_username
```
Running the Application
Start the Elasticsearch and Kibana containers.
Run the Python application:
```bash
python app.py
```
Access Kibana via http://localhost:5601 to view logs and manage your Elasticsearch data.

### Additional Notes
Make sure that you have Docker installed to run the containers.
Ensure that your Generative AI Key and Elasticsearch credentials are correct.
If you encounter any issues, check the logs in Kibana to troubleshoot Elasticsearch.
License
This project is licensed under the MIT License.

