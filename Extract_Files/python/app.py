import json
import os
import time
from pprint import pprint
from search import Search

def main():
    search_instance = Search()  # Create an instance of the Search class

    # Check if the model is already deployed
    if not search_instance.is_model_deployed():
        print("Deploying ELSER Model...")
        search_instance.deploy_elser()
        print("ELSER Model Deployed!")
    else:
        print("ELSER Model already deployed. Skipping deployment.")

    print("Reindexing...")
    result = search_instance.reindex()
    print("Reindexing completed")
    pprint(result)
    print("Data ingestion complete.")

    # Inserting documents for data ingestion
    try:
        with open("../data.json", "rt", encoding="utf-8") as f:
            documents = json.load(f)
            print(f"Loaded {len(documents)} documents from data.json")
        
        print("Inserting documents into Elasticsearch...")
        insertion_response = search_instance.insert_documents(documents)
        
        if insertion_response:
            print("Documents inserted successfully!")
        else:
            print("No documents were inserted.")
    
    except Exception as e:
        print(f"Error during document insertion: {e}")

if __name__ == "__main__":
    main()
