import json
from pprint import pprint
import os
import time
import logging
from dotenv import load_dotenv
from elasticsearch import Elasticsearch, exceptions
from sentence_transformers import SentenceTransformer

load_dotenv()

class Search:
    def __init__(self):
        # Initialize model and Elasticsearch connection
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        es_username = os.getenv("ES_USERNAME")
        es_password = os.getenv("ES_PASSWORD")
        cert_path = './http_ca.crt'
        self.es = Elasticsearch(
            'https://localhost:9200',
            http_auth=(es_username, es_password),
            ca_certs=cert_path,
            verify_certs=True
        )

        client_info = self.es.info()
        print("Connected to Elasticsearch!")
        pprint(client_info)

    def create_index(self):
        """Creates the index with mappings."""
        self.es.indices.delete(index="my_documents", ignore_unavailable=True)
        self.es.indices.create(
            index="my_documents",
            mappings={
                "properties": {
                    "embedding": {
                        "type": "dense_vector",
                    },
                    "elser_embedding": {
                        "type": "sparse_vector",
                    },
                    "summary": {
                        "type": "text"
                    }
                }
            },
            settings={"index": {"default_pipeline": "elser-ingest-pipeline"}},
        )

    def get_embedding(self, text):
        """Encodes the summary text into an embedding."""
        return self.model.encode(text)

    def insert_document(self, document):
        """Inserts a single document into Elasticsearch."""
        return self.es.index(
            index="my_documents",
            document={
                **document,
                "embedding": self.get_embedding(document["summary"]),
            },
        )

    def insert_documents(self, documents):
        """Inserts multiple documents into Elasticsearch in bulk."""
        operations = []
        for i, document in enumerate(documents):
            try:
                embedding = self.get_embedding(document["summary"])
                operations.append({"index": {"_index": "my_documents"}})
                operations.append(
                    {
                        **document,
                        "embedding": embedding,
                    }
                )
            except Exception as e:
                print(f"Error processing document {i}: {e}")
                print(f"Document content: {document}")
        
        print("Operations being sent to Elasticsearch:")
        pprint(operations)  # Debugging line

        if not operations:
            print("No operations to index.")
            return None

        response = self.es.bulk(operations=operations)
        print("Bulk insert response:", response)
        if response.get("errors", False):
            for i, item in enumerate(response["items"]):
                if "error" in item["index"]:
                    print(f"Error indexing document {i}: {item['index']['error']}")
                    print(f"Document: {documents[i]}")

        return response

    def reindex(self):
        """Recreates the index and inserts all documents."""
        self.create_index()
        with open("../data.json", "rt", encoding="utf-8") as f:
            documents = json.load(f)
        # for document in documents:
        #     print(f"Document: {document}")

    def search(self, **query_args):
        """Searches for documents in Elasticsearch."""
        if "from_" in query_args:
            query_args["from"] = query_args["from_"]
            del query_args["from_"]
        return self.es.search(
            index="my_documents",
            body=json.dumps(query_args),
        )

    def retrieve_document(self, id):
        """Retrieves a document by its ID."""
        return self.es.get(index="my_documents", id=id)

    def deploy_elser(self):
        """Deploys the ELSER model and pipeline."""
        # Download ELSER v2
        self.es.ml.put_trained_model(
            model_id=".elser_model_2", input={"field_names": ["text_field"]}
        )

        # Wait until the model is ready
        while True:
            status = self.es.ml.get_trained_models(
                model_id=".elser_model_2", include="definition_status"
            )
            if status["trained_model_configs"][0]["fully_defined"]:
                # Model is ready
                break
            time.sleep(1)

        # Deploy the model
        self.es.ml.start_trained_model_deployment(model_id=".elser_model_2")

        # Define a pipeline
        self.es.ingest.put_pipeline(
            id="elser-ingest-pipeline",
            processors=[
                {
                    "inference": {
                        "model_id": ".elser_model_2",
                        "input_output": [
                            {
                                "input_field": "summary",
                                "output_field": "elser_embedding",
                            }
                        ],
                    }
                }
            ],
        )

    def is_model_deployed(self):
        """Checks if the ELSER model and pipeline are already deployed."""
        try:
            # Check for the trained model
            self.es.ml.get_trained_models(model_id=".elser_model_2")
            # Check for the ingest pipeline
            self.es.ingest.get_pipeline(id="elser-ingest-pipeline")
            return True
        except exceptions.NotFoundError:
            return False
        except Exception as e:
            print(f"An error occurred while checking deployment status: {e}")
            return False
