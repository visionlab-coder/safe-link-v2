package com.safelink.v3.storage;

import java.net.URI;
import java.time.Duration;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

public class S3ObjectStorageService implements ObjectStorageService {
    private final S3Presigner presigner;
    private final S3Client s3;
    private final StorageProperties properties;

    public S3ObjectStorageService(S3Presigner presigner, S3Client s3, StorageProperties properties) {
        this.presigner = presigner;
        this.s3 = s3;
        this.properties = properties;
    }

    @Override
    public URI createUploadUrl(String objectKey, String contentType, Duration ttl) {
        var objectRequest = PutObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .contentType(contentType)
            .build();
        var presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .putObjectRequest(objectRequest)
            .build();
        return URI.create(presigner.presignPutObject(presignRequest).url().toString());
    }

    @Override
    public URI createDownloadUrl(String objectKey, Duration ttl) {
        var objectRequest = GetObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .build();
        var presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .getObjectRequest(objectRequest)
            .build();
        return URI.create(presigner.presignGetObject(presignRequest).url().toString());
    }

    @Override
    public void putObject(String objectKey, String contentType, byte[] bytes) {
        var objectRequest = PutObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .contentType(contentType)
            .build();
        s3.putObject(objectRequest, RequestBody.fromBytes(bytes));
    }

    @Override
    public StoredObject getObject(String objectKey) {
        var objectRequest = GetObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .build();
        ResponseBytes<GetObjectResponse> response = s3.getObjectAsBytes(objectRequest);
        String contentType = response.response().contentType() == null
            ? "application/octet-stream"
            : response.response().contentType();
        return new StoredObject(contentType, response.asByteArray());
    }

    @Override
    public ObjectMetadata headObject(String objectKey) {
        var response = s3.headObject(HeadObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .build());
        String contentType = response.contentType() == null
            ? "application/octet-stream"
            : response.contentType();
        return new ObjectMetadata(contentType, response.contentLength());
    }

    @Override
    public void deleteObject(String objectKey) {
        s3.deleteObject(DeleteObjectRequest.builder()
            .bucket(properties.getBucket())
            .key(objectKey)
            .build());
    }

    @Override
    public boolean isConfigured() {
        return true;
    }

    @Override
    public void verifyAvailable() {
        s3.headBucket(HeadBucketRequest.builder().bucket(properties.getBucket()).build());
    }
}
