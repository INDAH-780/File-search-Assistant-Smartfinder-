from flask import Flask, request, jsonify
import json
from search import Search
import re
import markdown

app = Flask(__name__)
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Initialize the Search class instance
search_instance = Search()

@app.route('/deploy_elser', methods=['GET'])
def deploy_elser():
    """Endpoint to deploy the ELSER model if not already deployed."""
    if not search_instance.is_model_deployed():
        print("Deploying ELSER Model...")
        search_instance.deploy_elser()
        return jsonify({"message": "ELSER model deployed."}), 200
    else:
        return jsonify({"message": "ELSER model already deployed."}), 200

@app.route('/search', methods=['GET'])
def handle_search():
    query = request.args.get("query", "")
    filters, parsed_query = extract_filters(query)
    from_ = request.args.get("from_", type=int, default=0)

    # Initialize a set to track the unique file types that have been added
    unique_file_types = set()

    # Get file types selected by the user
    file_types = request.args.getlist('file_type')  # Use getlist for multiple values
    file_type_filters = []

    # Iterate through each selected file type
    for file_type in file_types:
        if file_type not in unique_file_types:
            unique_file_types.add(file_type)
            file_type_filters.append(f'file_type:{file_type}')

    # Append the unique file type filters to the query string
    query += ' ' + ' '.join(file_type_filters)

    # Update filters to include the new file type filters
    filters = update_filters_with_file_types(filters, file_type_filters)

    # Build the search query
    if parsed_query:
        search_query = {
            "sub_searches": [
                {
                    "query": {
                        "bool": {
                            "must": {
                                "multi_match": {
                                    "query": parsed_query,
                                    "fields": ["name", "summary", "keywords"],
                                }
                            },
                            **filters,
                        }
                    }
                },
                {
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "text_expansion": {
                                        "elser_embedding": {
                                            "model_id": ".elser_model_2",
                                            "model_text": parsed_query,
                                        }
                                    },
                                }
                            ],
                            **filters,
                        }
                    },
                },
            ],
            "rank": {"rrf": {}},
            "aggs": {
                "category-agg": {
                    "terms": {
                        "field": "category.keyword",
                    }
                },
                "year-agg": {
                    "date_histogram": {
                        "field": "updated_at",
                        "calendar_interval": "year",
                        "format": "yyyy",
                    },
                },
                "file_type-agg": {
                    "terms": {
                        "field": "file_type.keyword",
                    }
                },
            },
        }
    else:
        search_query = {
            "query": {
                "bool": {
                    "must": {"match_all": {}},
                    **filters,
                }
            },
            "aggs": {
                "category-agg": {
                    "terms": {
                        "field": "category.keyword",
                    }
                },
                "year-agg": {
                    "date_histogram": {
                        "field": "updated_at",
                        "calendar_interval": "year",
                        "format": "yyyy",
                    },
                },
                "file_type-agg": {
                    "terms": {
                        "field": "file_type.keyword",
                    }
                },
            },
        }

    # Execute search query
    results = search_instance.search(
        **search_query,
        size=5,
        from_=from_,
    )

    aggs = {
        "Category": {
            bucket["key"]: bucket["doc_count"]
            for bucket in results["aggregations"]["category-agg"]["buckets"]
        },
        "Year": {
            bucket["key_as_string"]: bucket["doc_count"]
            for bucket in results["aggregations"]["year-agg"]["buckets"]
            if bucket["doc_count"] > 0
        },
        "File Types": {
            bucket["key"]: bucket["doc_count"]
            for bucket in results["aggregations"]["file_type-agg"]["buckets"]
        },
    }

    # Convert content from Markdown to HTML
    for result in results["hits"]["hits"]:
        result["_source"]["summary"] = markdown.markdown(result["_source"]["summary"])

    return jsonify({
        "results": results["hits"]["hits"],
        "query": query,
        "from_": from_,
        "total": results["hits"]["total"]["value"],
        "aggs": aggs,
    })

# Helper function to update filters with file type filters
def update_filters_with_file_types(filters, file_type_filters):
    if file_type_filters:
        filters['filter'] = {
            "bool": {
                "should": [{"term": {"file_type.keyword": file_type}} for file_type in file_type_filters]
            }
        }
    return filters

def extract_filters(query):
    filter_regex = r"category:([^\s]+)\s*"
    m = re.search(filter_regex, query)
    if m is None:
        return {}, query  # no filters
    filters = {"filter": [{"term": {"category.keyword": {"value": m.group(1)}}}]}
    query = re.sub(filter_regex, "", query).strip()
    return filters, query

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
