import functions_framework
import urllib.request
import json

ENDPOINTS = [
    {"url": "https://xj-next-521240388393.europe-west1.run.app/", "method": "GET"},
    {"url": "https://xj-strapi-521240388393.europe-west1.run.app/graphql", "method": "POST", "body": '{"query":"{ __typename }"}'},
    {"url": "https://starf.sosialistaflokkurinn.is/health/", "method": "GET"},
]

@functions_framework.http
def warmup(request):
    results = []
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep["url"], method=ep["method"])
            if ep.get("body"):
                req.add_header("Content-Type", "application/json")
                req.data = ep["body"].encode()
            with urllib.request.urlopen(req, timeout=30) as resp:
                results.append({"url": ep["url"], "status": resp.status})
        except Exception as e:
            results.append({"url": ep["url"], "error": str(e)})
    return json.dumps(results), 200
